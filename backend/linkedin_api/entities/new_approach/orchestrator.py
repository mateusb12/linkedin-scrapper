import json
from dataclasses import asdict
from datetime import date, datetime
from pathlib import Path

from backend.linkedin_api.entities.new_approach.pagination.pagination_recommended_jobs import parse_curl_command, \
    fetch_linkedin_jobs, parse_jobs_page
from backend.linkedin_api.entities.new_approach.single_job.fetch_single_job_details import make_session, \
    fetch_job_detail
from backend.linkedin_api.entities.new_approach.single_job.structure_single_job import extract_job_details
from backend.path.path_reference import get_orchestration_curls_folder_path

PAGINATION_CURL_COMMAND_PATH = Path(get_orchestration_curls_folder_path(), "pagination_curl.txt")
INDIVIDUAL_JOB_CURL_COMMAND_PATH = Path(get_orchestration_curls_folder_path(), "individual_job_curl.txt")


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
    with open(INDIVIDUAL_JOB_CURL_COMMAND_PATH, 'r') as file:
        INDIVIDUAL_JOB_CURL_COMMAND_CONTENT = file.read().strip()
    pagination_data = load_pagination_data()
    job_urn_ids = [item["urn"] for item in pagination_data["jobs"] if item is not None]
    session_object = make_session(INDIVIDUAL_JOB_CURL_COMMAND_CONTENT)
    raw_results = []
    for idx, urn in enumerate(job_urn_ids, start=1):
        try:
            print(f"[{idx}/{len(job_urn_ids)}] fetching {urn} … ", end="", flush=True)
            data = fetch_job_detail(session_object, urn)
            raw_results.append({"jobPostingUrn": urn, "detailResponse": data})
            print("✓ SUCCESS")
        except Exception as exc:
            print(f"FAILED → {exc}")
    structured_jobs = []
    for job_entry in raw_results:
        job_details = extract_job_details(job_entry)
        if job_details:
            structured_jobs.append(asdict(job_details))

    # 6. Persist both artefacts
    out_dir = Path("output")  # keep your repo root clean
    out_dir.mkdir(exist_ok=True)

    (out_dir / "pagination_data.json").write_text(
        json.dumps(pagination_data, indent=2, ensure_ascii=False,
                   default=lambda o: o.isoformat() if isinstance(o, (date, datetime)) else str(o)),
        encoding="utf-8",
    )
    (out_dir / "structured_jobs.json").write_text(
        json.dumps(structured_jobs, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )

    print(f"✔ Saved {len(pagination_data['jobs'])} raw rows → output/pagination_data.json")
    print(f"✔ Saved {len(structured_jobs)} parsed rows → output/structured_jobs.json")


if __name__ == "__main__":
    main()
