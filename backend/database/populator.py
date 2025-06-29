# populate_db.py

import json
from pathlib import Path

from backend.database.database_connection import get_db_session, create_db_and_tables
from backend.models.job_models import Company, Job
from backend.path.path_reference import get_output_curls_folder_path


def populate_from_json(json_filepath: str):
    """
    Parses a JSON file containing job data and populates the database.
    It checks for existing companies and jobs to avoid duplicates.
    """
    # Get a new database session
    session = get_db_session()

    print(f"Loading data from {json_filepath}...")
    path = Path(get_output_curls_folder_path(), json_filepath)
    with open(path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    jobs_data = data.get('jobs', [])
    print(f"Found {len(jobs_data)} jobs to process.")

    # Keep track of URNs we've added in this run to avoid duplicate DB checks
    processed_company_urns = set()
    processed_job_urns = set()

    for job_item in jobs_data:
        company_data = job_item.get('company')
        if not company_data or not company_data.get('urn'):
            continue  # Skip if company data or URN is missing

        company_urn = company_data['urn']

        # --- Process Company ---
        if company_urn not in processed_company_urns:
            # Check if company already exists in the database
            existing_company = session.query(Company).filter_by(urn=company_urn).first()
            if not existing_company:
                new_company = Company(
                    urn=company_urn,
                    name=company_data.get('name'),
                    logo_url=company_data.get('logo_url'),
                    url=company_data.get('url')
                )
                session.add(new_company)
                print(f"Adding new company: {new_company.name}")
            processed_company_urns.add(company_urn)

        # --- Process Job ---
        job_urn = job_item.get('urn')
        if job_urn and job_urn not in processed_job_urns:
            existing_job = session.query(Job).filter_by(urn=job_urn).first()
            if not existing_job:
                new_job = Job(
                    urn=job_urn,
                    title=job_item.get('title'),
                    location=job_item.get('location'),
                    workplace_type=job_item.get('workplace_type'),
                    employment_type=job_item.get('employment_type'),
                    posted_on=job_item.get('posted_on'),
                    job_url=job_item.get('job_url'),
                    description_full=job_item.get('description', {}).get('full_text'),
                    company_urn=company_urn
                )
                session.add(new_job)
                print(f"  -> Adding new job: {new_job.title}")
            processed_job_urns.add(job_urn)

    try:
        print("\nCommitting changes to the database...")
        session.commit()
        print("Successfully populated the database.")
    except Exception as e:
        print(f"An error occurred: {e}")
        session.rollback()
    finally:
        session.close()


if __name__ == "__main__":
    # 1. Create the database schema if it doesn't exist
    create_db_and_tables()

    # 2. Run the population script
    # Make sure 'combined_data.json' is in the same directory as this script
    populate_from_json('combined_data.json')