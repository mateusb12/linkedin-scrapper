import re
import json
import shlex
from dataclasses import dataclass, asdict
from typing import Optional, Dict, Any, Tuple
from urllib.parse import urlparse, parse_qs, unquote, urlencode

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
        """
        Input: Raw cURL string from Frontend.
        Action: Parses and updates columns.
        """
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

    def construct_request(self, page_number: int = 1) -> Tuple[str, Dict]:
        """
        Output: Ready-to-use URL and Headers for requests.get().
        """
        # 1. Calculate Start Index
        # Default count to 24 if missing
        count = self.variables_count if self.variables_count else 24
        start_index = (page_number - 1) * count

        # 2. Build Variables String
        # LinkedIn expects: (count:24,start:0,...)
        # We assume if it's Pagination, we need slug. If SingleJob, we might need different logic,
        # but for now we reconstruct based on what we have.

        vars_parts = []

        # Specific logic for Pagination vs Individual could go here,
        # but generic reconstruction is usually safer:

        if self.variables_count is not None:
            vars_parts.append(f"count:{count}")

        if self.variables_job_collection_slug:
            vars_parts.append(f"jobCollectionSlug:{self.variables_job_collection_slug}")

        if self.variables_query_origin:
            # origin is usually nested: query:(origin:...)
            vars_parts.append(f"query:(origin:{self.variables_query_origin})")

        # Always inject the calculated start
        vars_parts.append(f"start:{start_index}")

        # If we have stored raw variables (for complex individual requests), we might need a fallback,
        # but for Pagination, this reconstruction is perfect.
        variables_str = f"({','.join(vars_parts)})"

        # 3. Build Query Parameters
        params = {
            'variables': variables_str
        }
        if self.query_id:
            params['queryId'] = self.query_id

        # 4. Final URL
        # safe=':(),' ensures LinkedIn's weird syntax isn't double-encoded
        full_url = f"{self.base_url}?{urlencode(params, safe=':(),')}"

        # 5. Headers
        headers = {}
        if self.headers:
            try:
                headers = json.loads(self.headers)
            except:
                pass

        return full_url, headers


# --- Helper Parsing Classes & Functions ---

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
    parsed_uri = urlparse(raw_url)
    query_params = parse_qs(parsed_uri.query)

    # CORREÇÃO: Se for GraphQL, limpamos a URL para reconstruir as variáveis depois.
    # Mas se for um componente SDUI, precisamos da URL inteira (com o componentId).
    if 'variables' in query_params or 'queryId' in query_params:
        base_url = f"{parsed_uri.scheme}://{parsed_uri.netloc}{parsed_uri.path}"
    else:
        base_url = raw_url

    variables_raw = query_params.get('variables', [''])[0]
    variables_str = unquote(variables_raw)

    def find_val(key_name, is_int=False):
        pattern = re.compile(rf"\b{key_name}\s*:\s*([^,\)]+)")
        match = pattern.search(variables_str)
        if match:
            val = match.group(1).strip()
            if is_int and val.isdigit():
                return int(val)
            return val
        return None

    return {
        "base_url": base_url,
        "query_id": query_params.get('queryId', [None])[0],
        "variables_count": find_val('count', is_int=True),
        "variables_job_collection_slug": find_val('jobCollectionSlug'),
        "variables_query_origin": find_val('origin'),
        "variables_start": find_val('start', is_int=True),
    }


def parse_curl_string_flat(curl_string: str) -> Optional[FlatFetchCall]:
    curl_string = curl_string.replace('\\\n', ' ').replace('\n', ' ').strip()
    try:
        tokens = shlex.split(curl_string)
    except ValueError:
        return None

    url = None
    headers = {}
    body = None
    method = "GET"

    for i, token in enumerate(tokens):
        if token.startswith('http') and url is None:
            if i == 0 or tokens[i - 1] not in ('-H', '--header', '-d', '--data', '--data-raw', '--cookie', '-b', '-X',
                                               '--request'):
                url = token
        if token in ('-H', '--header') and i + 1 < len(tokens):
            if ':' in tokens[i + 1]:
                key, value = tokens[i + 1].split(':', 1)
                headers[key.strip()] = value.strip()
        if token in ('-b', '--cookie') and i + 1 < len(tokens):
            headers['Cookie'] = tokens[i + 1].strip()
        if token in ('-d', '--data', '--data-raw') and i + 1 < len(tokens):
            body = tokens[i + 1];
            method = "POST"

    if not url: return None
    url_data = _process_linkedin_url(url)

    return FlatFetchCall(
        **url_data, method=method, headers=json.dumps(headers), body=body, referer=headers.get("Referer")
    )


def parse_fetch_string_flat(fetch_string: str) -> Optional[FlatFetchCall]:
    try:
        match = re.search(r'fetch\("([^"]+)",\s*({.*})\);?', fetch_string, re.DOTALL)
        if not match: return None
        raw_url, options_str = match.groups()
        options_data = json.loads(options_str)
        url_data = _process_linkedin_url(raw_url)
        return FlatFetchCall(
            **url_data,
            method=options_data.get("method"),
            headers=json.dumps(options_data.get("headers", {})),
            body=json.dumps(options_data.get("body")),
            referer=options_data.get("headers", {}).get("Referer")
        )
    except:
        return None
