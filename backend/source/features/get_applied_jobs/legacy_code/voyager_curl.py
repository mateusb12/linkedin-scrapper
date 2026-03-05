import requests
from dataclasses import dataclass
from typing import Optional
from datetime import datetime, timezone, timedelta

# ============================================
# Timezones
# ============================================

UTC = timezone.utc
BRT = timezone(timedelta(hours=-3))


# ============================================
# Dataclass
# ============================================

@dataclass
class JobPosting:
    job_id: int
    title: str
    company_urn: Optional[str]
    location: Optional[str]

    created_at: Optional[int]
    listed_at: Optional[int]
    expire_at: Optional[int]

    applicants: Optional[int]

    applied: bool
    applied_at: Optional[int]

    # ----------------------------------------

    def _fmt_ts(self, ts: Optional[int]):
        if not ts:
            return "None"

        dt_utc = datetime.fromtimestamp(ts / 1000, tz=UTC)
        dt_brt = dt_utc.astimezone(BRT)

        utc_str = dt_utc.strftime("%Y-%m-%d %H:%M:%S")
        brt_str = dt_brt.strftime("%Y-%m-%d %H:%M:%S")

        return f"{utc_str} UTC | {brt_str} BRT"

    # ----------------------------------------

    def pretty_print(self):
        print("\n================ JOB POSTING ================\n")

        print(f"Job ID      : {self.job_id}")
        print(f"Title       : {self.title}")
        print(f"Company URN : {self.company_urn}")
        print(f"Location    : {self.location}")
        print(f"Applicants  : {self.applicants}")
        print(f"Applied     : {self.applied}")

        print("\n--------------- TIMESTAMPS ------------------\n")

        print(f"Created At  : {self._fmt_ts(self.created_at)}")
        print(f"Listed At   : {self._fmt_ts(self.listed_at)}")
        print(f"Applied At  : {self._fmt_ts(self.applied_at)}")
        print(f"Expire At   : {self._fmt_ts(self.expire_at)}")

        print("\n=============================================\n")


# ============================================
# Parser JSON -> Dataclass
# ============================================

def parse_job_posting(data: dict) -> JobPosting:
    company_urn = None
    company_details = data.get("companyDetails", {})

    if "com.linkedin.voyager.jobs.JobPostingCompany" in company_details:
        company_urn = company_details[
            "com.linkedin.voyager.jobs.JobPostingCompany"
        ].get("company")

    applying = data.get("applyingInfo", {})

    return JobPosting(
        job_id=data.get("jobPostingId"),
        title=data.get("title"),
        company_urn=company_urn,
        location=data.get("formattedLocation"),
        created_at=data.get("createdAt"),
        listed_at=data.get("listedAt"),
        expire_at=data.get("expireAt"),
        applicants=data.get("applies"),
        applied=applying.get("applied", False),
        applied_at=applying.get("appliedAt"),
    )


# ============================================
# HTTP Fetch
# ============================================

def fetch_job(job_id: str, csrf_token: str, cookie: str) -> JobPosting:
    url = f"https://www.linkedin.com/voyager/api/jobs/jobPostings/{job_id}"

    headers = {
        "accept": "application/json",
        "csrf-token": csrf_token,
        "user-agent": "Mozilla/5.0",
        "cookie": cookie,
    }

    response = requests.get(url, headers=headers)

    print("STATUS:", response.status_code)

    data = response.json()

    job = parse_job_posting(data)

    return job


# ============================================
# MAIN
# ============================================

if __name__ == "__main__":
    JOB_ID = "4378603610"

    CSRF_TOKEN = "ajax:2777072973261931503"

    COOKIE = (
        'li_at=AQEDAT016UkA2kzbAAABnLWy_BEAAAGc2b-AEU0AeCarHPFpq8noGEAStRJiOmwuKQEhik6SrxpIxyFGN0CDlXsf1Bv8dH3N9Te5KKMgZl3cwU3BAH8anP3HvWie6d5i5XVPwhaWCCKeGMIOQEZ_ydxq; '
        'JSESSIONID="ajax:2777072973261931503"'
    )

    job = fetch_job(
        job_id=JOB_ID,
        csrf_token=CSRF_TOKEN,
        cookie=COOKIE
    )

    job.pretty_print()
