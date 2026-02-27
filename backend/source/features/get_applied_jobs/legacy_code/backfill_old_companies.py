import sys
import time
from pathlib import Path

# Add backend to path so we can import internal modules
sys.path.append(str(Path(__file__).parent))

from source.features.get_applied_jobs.legacy_code.fetch_linkedin_applied_jobs import (
    _process_page_data,
    get_linkedin_fetch_artefacts
)
from source.features.job_population.job_repository import JobRepository


def run_deep_clean():
    print("\n--- 🧹 STARTING DEEP BACKFILL (FIXING ALL COMPANIES) ---")

    repo = JobRepository()
    session, config = get_linkedin_fetch_artefacts()

    if not session or not config:
        print("❌ Could not load session. Run the frontend update first.")
        return

    base_url = config.get('base_url')
    query_id = config.get('query_id')

    # 1. Fetch Page 1 to get the Total Count
    print("   📡 Pinging LinkedIn to get total count...")
    try:
        url = f"{base_url}?variables=(start:0,query:(flagshipSearchIntent:SEARCH_MY_ITEMS_JOB_SEEKER))&queryId={query_id}"
        resp = session.get(url)
        data = resp.json()

        paging = data.get('data', {}).get('data', {}).get('searchDashClustersByAll', {}).get('paging', {})
        total_jobs = paging.get('total', 0)

        print(f"   📊 Found {total_jobs} total applications. Starting batch processing...")
    except Exception as e:
        print(f"❌ Failed initial fetch: {e}")
        return

    # 2. Iterate ALL Pages
    all_jobs_processed = []
    page_size = 10

    # Range from 0 to Total, stepping by 10
    for start_index in range(0, total_jobs, page_size):
        print(f"\n   🔄 Processing batch {start_index} - {start_index + page_size}...")

        try:
            # Construct URL for this specific page
            variables = f"(start:{start_index},query:(flagshipSearchIntent:SEARCH_MY_ITEMS_JOB_SEEKER))"
            page_url = f"{base_url}?variables={variables}&queryId={query_id}"

            response = session.get(page_url)

            if response.status_code != 200:
                print(f"      ⚠️ Failed batch {start_index} (Status: {response.status_code}). Skipping.")
                continue

            # This function contains the logic to:
            # 1. Extract Company URN
            # 2. Create Company if missing
            # 3. Link Job to Company
            # 4. Fetch Timestamp if missing
            new, updated = _process_page_data(response.json(), repo, all_jobs_processed, session)

            print(f"      ✅ Batch complete: {updated} jobs fixed/updated.")

            # Be nice to LinkedIn API
            time.sleep(1.5)

        except Exception as e:
            print(f"      ❌ Error on batch {start_index}: {e}")

    print("\n--- ✨ DEEP CLEAN COMPLETE ---")
    repo.close()


if __name__ == "__main__":
    run_deep_clean()
