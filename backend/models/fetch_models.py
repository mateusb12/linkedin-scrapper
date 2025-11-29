import re
import json
import shlex
from dataclasses import dataclass, asdict
from typing import Optional, Dict, Any
from urllib.parse import urlparse, parse_qs, unquote # <--- Added unquote

# --- SQLAlchemy ORM Setup ---
from sqlalchemy import Column, Integer, String, Text
from .base_model import Base


class FetchCurl(Base):
    __tablename__ = 'fetch_curl'

    id = Column(Integer, primary_key=True)
    name = Column(String, default="FetchCallRecord", nullable=False)

    # URL Parts
    base_url = Column(String)
    query_id = Column(String)

    # Variables from URL
    variables_count = Column(Integer)
    variables_job_collection_slug = Column(String)
    variables_query_origin = Column(String)
    variables_start = Column(Integer)

    # Request Options
    method = Column(String)
    headers = Column(Text)
    body = Column(Text)
    referer = Column(String)
    cookies = Column(Text, nullable=True)

    def to_dict(self):
        parsed_headers = {}
        if self.headers:
            try:
                parsed_headers = json.loads(self.headers)
            except (json.JSONDecodeError, TypeError):
                parsed_headers = {}

        parsed_body = None
        if self.body:
            try:
                parsed_body = json.loads(self.body)
            except (json.JSONDecodeError, TypeError):
                parsed_body = {}

        return {
            "id": self.id,
            "name": self.name,
            "base_url": self.base_url,
            "query_id": self.query_id,
            "variables_count": self.variables_count,
            "variables_job_collection_slug": self.variables_job_collection_slug,
            "variables_query_origin": self.variables_query_origin,
            "variables_start": self.variables_start,
            "method": self.method,
            "headers": parsed_headers,
            "body": parsed_body,
            "referer": self.referer,
            "cookies": self.cookies,
        }

    def update_from_raw(self, raw_body: str):
        if not raw_body:
            raise ValueError("Request body cannot be empty.")

        command_string = raw_body.strip()
        try:
            json_body = json.loads(raw_body)
            if isinstance(json_body, dict):
                command_string = json_body.get("curl") or json_body.get("fetch") or json_body.get("command") or raw_body
        except json.JSONDecodeError:
            pass

        structured_data = None
        if command_string.strip().startswith("curl"):
            structured_data = parse_curl_string_flat(command_string)
        elif "fetch(" in command_string:
            structured_data = parse_fetch_string_flat(command_string)

        if not structured_data:
            raise ValueError("Could not parse string. Ensure it is a valid cURL command.")

        data_dict = asdict(structured_data)

        for key, value in data_dict.items():
            if hasattr(self, key):
                setattr(self, key, value)

        self.body = raw_body

@dataclass
class FlatFetchCall:
    base_url: Optional[str] = None
    query_id: Optional[str] = None
    variables_count: Optional[int] = None
    variables_job_collection_slug: Optional[str] = None
    variables_query_origin: Optional[str] = None
    variables_start: Optional[int] = None
    method: Optional[str] = None
    headers: Optional[str] = None
    body: Optional[str] = None
    referer: Optional[str] = None

def _process_linkedin_url(raw_url: str) -> Dict[str, Any]:
    """
    Robustly extracts LinkedIn variables using targeted regex.
    """
    parsed_uri = urlparse(raw_url)
    # Reconstruct base URL without query params
    base_url = f"{parsed_uri.scheme}://{parsed_uri.netloc}{parsed_uri.path}"
    query_params = parse_qs(parsed_uri.query)

    # Get the variables string and UNQUOTE it (fix %3A, %28, etc.)
    variables_raw = query_params.get('variables', [''])[0]
    variables_str = unquote(variables_raw)

    # Helper to find a value by key in the messy string
    def find_val(key_name, is_int=False):
        # Look for "key:value" or "key: value"
        # Stop capturing at comma, closing paren, or end of string
        pattern = re.compile(rf"\b{key_name}\s*:\s*([^,\)]+)")
        match = pattern.search(variables_str)
        if match:
            val = match.group(1).strip()
            if is_int and val.isdigit():
                return int(val)
            return val
        return None

    # Targeted Extraction
    count = find_val('count', is_int=True)
    start = find_val('start', is_int=True)
    slug = find_val('jobCollectionSlug')

    # Origin is usually nested in query:(origin:...), so we search explicitly
    origin = find_val('origin')

    return {
        "base_url": base_url,
        "query_id": query_params.get('queryId', [None])[0],
        "variables_count": count,
        "variables_job_collection_slug": slug,
        "variables_query_origin": origin,
        "variables_start": start,
    }

def parse_curl_string_flat(curl_string: str) -> Optional[FlatFetchCall]:
    curl_string = curl_string.replace('\\\n', ' ').replace('\n', ' ').strip()
    try:
        tokens = shlex.split(curl_string)
    except ValueError as e:
        print(f"Error splitting cURL string: {e}")
        return None

    url = None
    headers = {}
    body = None
    method = "GET"

    for i, token in enumerate(tokens):
        if token.startswith('http') and url is None:
            if i == 0 or tokens[i-1] not in ('-H', '--header', '-d', '--data', '--data-raw', '--cookie', '-b', '-X', '--request'):
                url = token

        if token in ('-H', '--header') and i + 1 < len(tokens):
            header_raw = tokens[i+1]
            if ':' in header_raw:
                key, value = header_raw.split(':', 1)
                headers[key.strip()] = value.strip()

        if token in ('-b', '--cookie') and i + 1 < len(tokens):
            headers['Cookie'] = tokens[i+1].strip()

        if token in ('-d', '--data', '--data-raw', '--data-binary') and i + 1 < len(tokens):
            body = tokens[i+1]
            method = "POST"

        if token in ('-X', '--request') and i + 1 < len(tokens):
            method = tokens[i+1]

    if not url:
        return None

    url_data = _process_linkedin_url(url)

    return FlatFetchCall(
        **url_data,
        method=method,
        headers=json.dumps(headers),
        body=body,
        referer=headers.get("Referer")
    )

def parse_fetch_string_flat(fetch_string: str) -> Optional[FlatFetchCall]:
    try:
        match = re.search(r'fetch\("([^"]+)",\s*({.*})\);?', fetch_string, re.DOTALL)
        if not match:
            return None
        raw_url, options_str = match.groups()

        options_data = json.loads(options_str)
        headers_json = json.dumps(options_data.get("headers", {}), indent=2)
        body_json = json.dumps(options_data.get("body"))

        url_data = _process_linkedin_url(raw_url)

        return FlatFetchCall(
            **url_data,
            method=options_data.get("method"),
            headers=headers_json,
            body=body_json,
            referer=options_data.get("headers", {}).get("Referer")
        )

    except Exception as e:
        print(f"Error parsing Fetch: {e}")
        return None