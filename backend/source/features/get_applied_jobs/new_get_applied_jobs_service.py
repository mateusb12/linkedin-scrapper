import json
import re
import time
from datetime import datetime, timezone
from database.database_connection import get_db_session
from models.fetch_models import FetchCurl
from source.features.fetch_curl.linkedin_http_client import LinkedInClient, LinkedInRequest


# ============================================================
# RAW REQUEST WRAPPER
# ============================================================

class RawStringRequest(LinkedInRequest):
    def __init__(self, method: str, url: str, body_str: str, debug: bool = False):
        super().__init__(method, url, debug=debug)
        self.body_str = body_str

    def execute(self, session, timeout=15):
        merged_headers = session.headers.copy()

        for k, v in self._headers.items():
            if k.lower() in ["accept-encoding", "content-length"]:
                continue
            merged_headers[k] = v

        if self.debug:
            print(f"🚀 [REQ] {self.method} {self.url}")

        return session.request(
            method=self.method,
            url=self.url,
            headers=merged_headers,
            data=self.body_str.encode("utf-8") if self.body_str else None,
            timeout=timeout,
        )


# ============================================================
# STREAM PARSER
# ============================================================

def parse_linkedin_stream(raw_text: str) -> list:
    parsed_items = []
    lines = raw_text.split("\n")

    for line in lines:
        if not line.strip():
            continue

        try:
            if ":" in line and len(line) > 1 and line[0].isalnum():
                parts = line.split(":", 1)
                if len(parts[0]) < 20:
                    json_val = json.loads(parts[1])
                    parsed_items.append({"stream_id": parts[0], "content": json_val})
                else:
                    parsed_items.append(json.loads(line))
            else:
                parsed_items.append(json.loads(line))
        except Exception:
            pass

    return parsed_items


# ============================================================
# RECURSIVE JOB FINDER
# ============================================================

def find_job_objects_recursive(data):
    found_jobs = []

    if isinstance(data, dict):
        if "companyName" in data:
            found_jobs.append(data)

        for value in data.values():
            found_jobs.extend(find_job_objects_recursive(value))

    elif isinstance(data, list):
        for item in data:
            found_jobs.extend(find_job_objects_recursive(item))

    return found_jobs


# ============================================================
# UTIL
# ============================================================

def ms_to_datetime(ms):
    try:
        return datetime.fromtimestamp(int(ms) / 1000, tz=timezone.utc)
    except:
        return None


# ============================================================
# EXTRAÇÃO
# ============================================================

def extract_jobs_from_stream(stream_items: list) -> list:
    jobs = []
    seen_ids = set()
    all_candidates = []

    for item in stream_items:
        content = item.get("content", item) if isinstance(item, dict) else item
        found = find_job_objects_recursive(content)
        all_candidates.extend(found)

    for data in all_candidates:
        try:
            title = data.get("title") or data.get("jobTitle")
            if not title:
                continue

            company = data.get("companyName", "Unknown")

            raw_id = (
                    data.get("jobPostingUrn")
                    or data.get("entityUrn")
                    or data.get("jobId")
            )

            if not raw_id:
                unique_str = f"{title}-{company}"
                raw_id = f"gen_{hash(unique_str)}"

            if raw_id in seen_ids:
                continue

            seen_ids.add(raw_id)

            location = (
                    data.get("location")
                    or data.get("formattedLocation")
                    or data.get("locationPrimary")
                    or ""
            )

            job_url = ""
            job_id = None
            if data.get("jobId"):
                job_id = data["jobId"]
                job_url = f"https://www.linkedin.com/jobs/view/{job_id}/"
            else:
                # fallback extração via URN
                urn = data.get("jobPostingUrn")
                if urn:
                    match = re.search(r'jobPosting:(\d+)', urn)
                    if match:
                        job_id = match.group(1)
                        job_url = f"https://www.linkedin.com/jobs/view/{job_id}/"

            listed_dt = ms_to_datetime(data.get("listedAt"))
            original_dt = ms_to_datetime(data.get("originallyListedAt"))

            jobs.append({
                "title": title,
                "company": company,
                "location": location,
                "source_id": raw_id,
                "job_id": job_id,
                "job_url": job_url,
                "date_posted": listed_dt.strftime("%Y-%m-%d") if listed_dt else None,
                "listed_at": listed_dt.isoformat() if listed_dt else None,
                "originally_listed_at": original_dt.isoformat() if original_dt else None,
                "is_reposted": bool(
                    listed_dt and original_dt and listed_dt != original_dt
                ),
                "apply_method": data.get("currentStageKey", "UNKNOWN"),
            })

        except Exception as e:
            print(f"Erro extraindo job: {e}")

    return jobs


# ============================================================
# FETCHER
# ============================================================

class JobTrackerFetcher:

    def __init__(self, debug: bool = False):
        self.debug = debug
        self.client = LinkedInClient("SavedJobs")

        if not self.client.config:
            raise ValueError("Configuração 'SavedJobs' não encontrada.")

        db = get_db_session()
        try:
            record = db.query(FetchCurl).filter(FetchCurl.name == "SavedJobs").first()
            if not record:
                raise ValueError("Registro 'SavedJobs' não existe.")

            self.base_url = record.base_url
            self.method = record.method or "POST"
            self.base_body_str = record.body or ""
        finally:
            db.close()

    # ----------------------------------------------------------
    # 🔥 NOVO: busca appliedAt via jobPostings
    # ----------------------------------------------------------

    def fetch_job_details(self, job_id: str):
        session = self.client.session

        csrf = session.cookies.get("JSESSIONID")
        if csrf:
            csrf = csrf.replace('"', '')

        url = f"https://www.linkedin.com/voyager/api/jobs/jobPostings/{job_id}"

        headers = {
            "accept": "application/json",
            "x-restli-protocol-version": "2.0.0",
            "csrf-token": csrf,
        }

        response = session.get(url, headers=headers)

        if response.status_code != 200:
            return {}

        try:
            data = response.json()

            applying_info = data.get("applyingInfo", {})

            applied_at = applying_info.get("appliedAt")
            applied_dt = ms_to_datetime(applied_at) if applied_at else None

            expire_at = data.get("expireAt")
            expire_dt = ms_to_datetime(expire_at) if expire_at else None

            activities = applying_info.get("activities", [])
            activity_text = activities[0].get("text") if activities else None

            return {
                "applied_at": applied_dt.isoformat() if applied_dt else None,
                "applicants": data.get("applies"),
                "job_state": data.get("jobState"),
                "expire_at": expire_dt.isoformat() if expire_dt else None,
                "experience_level": data.get("formattedExperienceLevel"),
                "employment_status": data.get("employmentStatus"),
                "application_closed": applying_info.get("closed"),
                "application_activity_text": activity_text,
                "work_remote_allowed": data.get("workRemoteAllowed"),
            }

        except Exception:
            return {}

    # ----------------------------------------------------------

    def fetch_jobs(self, stage: str = "saved") -> dict:

        target_url = self.base_url
        target_body = self.base_body_str

        if stage != "saved":
            target_url = target_url.replace("stage=saved", f"stage={stage}")
            if target_body:
                target_body = target_body.replace('"stage":"saved"', f'"stage":"{stage}"')
                target_body = target_body.replace("stage=saved", f"stage={stage}")

        req = RawStringRequest(self.method, target_url, target_body, self.debug)
        response = self.client.execute(req)

        if response.status_code != 200:
            raise Exception(f"Erro LinkedIn: {response.status_code}")

        raw_text = response.content.decode("utf-8", errors="ignore")

        stream_items = parse_linkedin_stream(raw_text)
        clean_jobs = extract_jobs_from_stream(stream_items)

        # 🔥 ENRIQUECIMENTO applied_at
        if stage == "applied":
            print("\n🔍 Buscando appliedAt individual...")
            for job in clean_jobs:
                try:
                    job_id = job.get("job_id")
                    if not job_id:
                        job["applied_at"] = None
                        continue

                    details = self.fetch_job_details(job_id)

                    job.update(details)

                    time.sleep(0.2)  # evitar flood

                except Exception as e:
                    print(f"Erro buscando appliedAt: {e}")
                    job["applied_at"] = None

        return {
            "count": len(clean_jobs),
            "jobs": clean_jobs,
            "stage": stage,
        }
