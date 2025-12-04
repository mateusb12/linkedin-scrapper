# run_description_backfill.py

import time
import sys
from pathlib import Path

# Add project root to python path
sys.path.append(str(Path(__file__).parent))

from database.database_connection import get_db_session
from models import Job
from source.features.get_applied_jobs.linkedin_fetch_call_repository import get_linkedin_fetch_artefacts
from source.features.job_population.enrichment_service import EnrichmentService

def backfill_descriptions():
    print("\n--- 🛠️ STARTING DESCRIPTION BACKFILL ---")

    # 1. Get Database Session
    db = get_db_session()

    # 2. Get Authenticated Session (Cookies/Headers)
    session, config = get_linkedin_fetch_artefacts()
    if not session:
        print("❌ Could not load LinkedIn session. Please update cookies.")
        return

    # 3. Find target jobs (No description + Applied)
    # You can adjust the filter to target specific jobs
    target_jobs = db.query(Job).filter(
        Job.description_full == "No description provided"
    ).order_by(Job.posted_on.desc()).all()

    print(f"   📉 Found {len(target_jobs)} jobs missing descriptions.")

    count = 0
    for job in target_jobs:
        count += 1
        print(f"\n[{count}/{len(target_jobs)}] Processing: {job.title} ({job.company_urn})")

        # 4. Fetch
        description = EnrichmentService.fetch_single_job_description(session, job.urn)

        # 5. Save if successful
        if description:
            job.description_full = description
            # Mark as not processed so the AI keyword extractor runs on it later
            job.processed = False
            db.commit()
            print("      💾 Saved to Database.")
        else:
            print("      ⚠️ Skipping save.")

        # 6. Safety Sleep (Crucial to avoid ban)
        time.sleep(2)

    print("\n--- ✅ BACKFILL COMPLETE ---")
    db.close()

if __name__ == "__main__":
    backfill_descriptions()