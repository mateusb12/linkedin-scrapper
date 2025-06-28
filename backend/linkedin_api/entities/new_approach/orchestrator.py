from dataclasses import asdict
from pathlib import Path

from backend.linkedin_api.entities.new_approach.pagination.pagination_recommended_jobs import parse_curl_command, \
    fetch_linkedin_jobs, parse_jobs_page
from backend.path.path_reference import get_orchestration_curls_folder_path

PAGINATION_CURL_COMMAND_PATH = Path(get_orchestration_curls_folder_path(), "pagination_curl.txt")


def load_pagination_data():
    try:
        with open(PAGINATION_CURL_COMMAND_PATH, 'r') as file:
            PAGINATION_CURL_COMMAND_CONTENT = file.read().strip()
        url, headers = parse_curl_command(PAGINATION_CURL_COMMAND_CONTENT)
        print("--- Successfully parsed cURL command ---")
        print("IMPORTANT: The cURL command contains sensitive, time-limited tokens (cookie, csrf-token).")
        print(
            "You will need to paste a fresh cURL command from your browser when they expire for the script to work.\n")
    except ValueError as e:
        print(f"Error: Could not parse the cURL command. Please check its format.")
        print(f"Details: {e}")
        return

    live_data = fetch_linkedin_jobs(url, headers)
    parsed_page = parse_jobs_page(live_data)
    return asdict(parsed_page)


def main():
    pagination_data = load_pagination_data()
    pass


if __name__ == "__main__":
    main()
