import re
import json
from dataclasses import dataclass, asdict
from typing import Optional
from urllib.parse import urlparse, parse_qs

# --- SQLAlchemy ORM Setup ---
from sqlalchemy import create_engine, Column, Integer, String, Text
from sqlalchemy.orm import sessionmaker

from models import Base


# 2. Define the ORM Model for our data
class FetchCurl(Base):
    """
    SQLAlchemy ORM model to store the flattened fetch call data in a database.
    """
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
    headers = Column(Text)  # Stored as a JSON string
    body = Column(Text)  # Stored as a JSON string
    referer = Column(String)

    def __repr__(self):
        return f"<FetchCallRecord(id={self.id}, method='{self.method}', url='{self.base_url}')>"

    def to_dict(self):
        """
        Serializes the object to a dictionary, ensuring that JSON strings for
        headers and body are parsed into proper dictionary objects.
        """
        parsed_headers = {}
        if self.headers:
            try:
                # Parse the string representation of headers into a dict
                parsed_headers = json.loads(self.headers)
            except (json.JSONDecodeError, TypeError):
                # Handle cases where headers are not a valid JSON string
                parsed_headers = {"error": "Invalid JSON format in headers field."}

        parsed_body = None
        if self.body:
            try:
                # Parse the string representation of the body
                parsed_body = json.loads(self.body)
            except (json.JSONDecodeError, TypeError):
                parsed_body = {"error": "Invalid JSON format in body field."}

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
            "headers": parsed_headers,  # Use the parsed dictionary
            "body": parsed_body,          # Use the parsed body
            "referer": self.referer,
        }


# --- Dataclass Definition (for parsing) ---
@dataclass
class FlatFetchCall:
    """
    Represents a flattened fetch call, used as an intermediate step before
    creating the ORM model instance.
    """
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


def parse_fetch_string_flat(fetch_string: str) -> Optional[FlatFetchCall]:
    """
    Parses a string containing a JavaScript fetch() call and structures it
    into a single, flat Python dataclass.

    Args:
        fetch_string: A string containing the raw fetch call.

    Returns:
        A FlatFetchCall dataclass instance with the parsed data, or None if
        parsing fails.
    """
    try:
        # This regex is designed to capture the URL and the options object from the fetch call.
        # The trailing `?;` makes the semicolon at the end optional for more flexibility.
        match = re.search(r'fetch\("([^"]+)",\s*({.*})\);?', fetch_string, re.DOTALL)
        if not match:
            print("Error: Could not find a valid fetch() call pattern.")
            return None
        raw_url, options_str = match.groups()

        # Safely load JSON data from the options string
        options_data = json.loads(options_str)
        headers_json = json.dumps(options_data.get("headers", {}), indent=2)
        body_json = json.dumps(options_data.get("body"))

        # Parse the URL to extract its components
        parsed_uri = urlparse(raw_url)
        base_url = f"{parsed_uri.scheme}://{parsed_uri.netloc}{parsed_uri.path}"
        query_params = parse_qs(parsed_uri.query)

        # Parse the 'variables' query parameter, which has a custom format
        variables_dict = {}
        variables_str = query_params.get('variables', [''])[0].strip('()')
        # Regex to find key-value pairs within the variables string
        var_pattern = re.compile(r"(\w+):\s*([^,]+(?:\([^)]+\))?)")
        var_matches = var_pattern.findall(variables_str)

        for key, value in var_matches:
            # Handle nested structures like 'query:(...)'
            if value.startswith('(') and value.endswith('('):
                nested_pattern = re.compile(r"(\w+):([\w_]+)")
                nested_matches = nested_pattern.findall(value.strip('()'))
                variables_dict[key] = dict(nested_matches)
            elif value.isdigit():
                variables_dict[key] = int(value)
            else:
                variables_dict[key] = value

        # Populate the dataclass with all extracted information
        flat_fetch_call = FlatFetchCall(
            base_url=base_url,
            query_id=query_params.get('queryId', [None])[0],
            variables_count=variables_dict.get('count'),
            variables_job_collection_slug=variables_dict.get('jobCollectionSlug'),
            variables_query_origin=variables_dict.get('query', {}).get('origin'),
            variables_start=variables_dict.get('start'),
            method=options_data.get("method"),
            headers=headers_json,
            body=body_json,
            referer=options_data.get("headers", {}).get("Referer")
        )

        return flat_fetch_call

    except (json.JSONDecodeError, IndexError, Exception) as e:
        print(f"An error occurred during parsing: {e}")
        return None


# --- Example Usage ---
if __name__ == "__main__":
    # 3. Setup the database engine (in-memory SQLite for this example)
    engine = create_engine('sqlite:///:memory:')

    # 4. Create the table in the database
    Base.metadata.create_all(engine)

    # 5. Create a session to interact with the database
    Session = sessionmaker(bind=engine)
    session = Session()

    # The input string provided by the user
    input_string = r'''
    fetch("https://www.linkedin.com/voyager/api/graphql?variables=(count:24,jobCollectionSlug:recommended,query:(origin:GENERIC_JOB_COLLECTIONS_LANDING),start:48)&queryId=voyagerJobsDashJobCards.93590893e4adb90623f00d61719b838c", {
      "headers": { "Referer": "https://www.linkedin.com/jobs/collections/recommended/" },
      "body": null, "method": "GET" });
    '''
    cleaned_string = " ".join(input_string.split())

    # Parse the string into the intermediate dataclass
    structured_data = parse_fetch_string_flat(cleaned_string)

    if structured_data:
        print("--- Parsing Successful ---")

        # Convert the dataclass to a dictionary
        data_dict = asdict(structured_data)

        # Create an instance of the ORM model
        new_record = FetchCurl(**data_dict)
        print(f"\n[+] Created ORM object: {new_record}")

        # Add the new record to the session and commit to the database
        session.add(new_record)
        session.commit()
        print("\n[+] Record committed to the in-memory database.")

        # Verify by querying the database
        retrieved_record = session.query(FetchCurl).first()
        print("\n[+] Verified by querying the database:")
        print(f"  - ID: {retrieved_record.id}")
        print(f"  - Method: {retrieved_record.method}")
        print(f"  - Referer: {retrieved_record.referer}")
        print(f"  - Headers (JSON): {retrieved_record.headers[:50]}...")

    # Close the session
    session.close()
