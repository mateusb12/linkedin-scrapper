"""
LinkedIn Jobs Scraper
Hardcoded curl request converted to Python.
Parses the LinkedIn normalized JSON into small, payload-aligned dataclasses
for search results and saves raw JSON for inspection.
"""

import json
import gzip
import os
import urllib.request
import urllib.error
from dataclasses import dataclass, field
from typing import Optional


# ---------------------------------------------------------------------------
# Dataclass definitions
# ---------------------------------------------------------------------------

@dataclass
class Company:
    name: Optional[str] = None
    linkedin_url: Optional[str] = None
    logo_url: Optional[str] = None
    verified: Optional[bool] = None


@dataclass
class LinkedInJobCard:
    job_id: Optional[str] = None
    title: Optional[str] = None
    location: Optional[str] = None

    company: Optional[Company] = None

    job_posting_urn: Optional[str] = None
    normalized_job_posting_urn: Optional[str] = None

    reposted: Optional[bool] = None
    content_source: Optional[str] = None

    @property
    def linkedin_url(self) -> Optional[str]:
        if not self.job_id:
            return None
        return f"https://www.linkedin.com/jobs/view/{self.job_id}"

    def __str__(self) -> str:
        company_name = self.company.name if self.company and self.company.name else "Unknown company"
        location = self.location or "Unknown location"

        lines = [
            f"{'─' * 60}",
            f"  {self.title or 'Unknown title'}",
            f"  {company_name}  |  {location}",
        ]

        if self.reposted:
            lines.append("  Flags  : Reposted")

        if self.content_source:
            lines.append(f"  Source : {self.content_source}")

        if self.company and self.company.linkedin_url:
            lines.append(f"  Company: {self.company.linkedin_url}")

        if self.linkedin_url:
            lines.append(f"  Job URL : {self.linkedin_url}")

        return "\n".join(lines)


@dataclass
class JobSearchMetadata:
    keywords: Optional[str] = None
    location: Optional[str] = None
    total_results: int = 0
    start: int = 0
    count: int = 0


@dataclass
class LinkedInSearchResponse:
    metadata: Optional[JobSearchMetadata] = None
    jobs: list[LinkedInJobCard] = field(default_factory=list)

    def __str__(self) -> str:
        meta = self.metadata or JobSearchMetadata()
        first = meta.start + 1 if self.jobs else 0
        last = meta.start + len(self.jobs)

        header = (
            f"\n{'═' * 60}\n"
            f"  LinkedIn Job Search Results\n"
            f"  Total: {meta.total_results:,}  |  Showing {first}–{last}\n"
            f"  Keywords: {meta.keywords or '-'}\n"
            f"  Location: {meta.location or '-'}\n"
            f"{'═' * 60}"
        )
        return header + ("\n" + "\n".join(str(job) for job in self.jobs) if self.jobs else "")


# ---------------------------------------------------------------------------
# Scraper class
# ---------------------------------------------------------------------------

class LinkedInJobsScraper:
    """
    Fetches LinkedIn job search results using a hardcoded authenticated
    request derived from browser devtools / curl export.

    NOTE: The session cookies (li_at, JSESSIONID, csrf-token) expire quickly.
    Replace them with a fresh browser session when they stop working.
    """

    URL = (
        "https://www.linkedin.com/voyager/api/voyagerJobsDashJobCards"
        "?decorationId=com.linkedin.voyager.dash.deco.jobs.search.JobSearchCardsCollectionLite-88"
        "&count=7"
        "&q=jobSearch"
        "&query=(currentJobId:4383315635,origin:JOBS_HOME_KEYWORD_HISTORY,"
        "keywords:Python%20NOT%20Est%C3%A1gio%20NOT%20Junior%20NOT%20Senior,"
        "locationUnion:(geoId:106057199),selectedFilters:(distance:List(25.0),workplaceType:List(2)),"
        "spellCorrectionEnabled:true)"
        "&servedEventEnabled=false"
        "&start=0"
    )

    HEADERS = {
        "User-Agent": "Mozilla/5.0 (X11; Linux x86_64; rv:147.0) Gecko/20100101 Firefox/147.0",
        "Accept": "application/vnd.linkedin.normalized+json+2.1",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "gzip, deflate, br, zstd",
        "x-li-lang": "en_US",
        "x-li-track": '{"clientVersion":"1.13.42707","mpVersion":"1.13.42707","osName":"web","timezoneOffset":-3,"timezone":"America/Fortaleza","deviceFormFactor":"DESKTOP","mpName":"voyager-web","displayDensity":1,"displayWidth":1920,"displayHeight":1080}',
        "x-li-page-instance": "urn:li:page:d_flagship3_search_srp_jobs;d58W4sOdSoCaV3kV/8YB9w==",
        "csrf-token": "ajax:2777072973261931503",
        "x-restli-protocol-version": "2.0.0",
        "x-li-pem-metadata": "Voyager - Careers - Jobs Search=jobs-search-results-prefetch",
        "x-li-deco-include-micro-schema": "true",
        "Alt-Used": "www.linkedin.com",
        "Connection": "keep-alive",
        "Referer": "https://www.linkedin.com/jobs/search/?currentJobId=4383315635&distance=25.0&f_WT=2&geoId=106057199&keywords=Python%20NOT%20Est%C3%A1gio%20NOT%20Junior%20NOT%20Senior&origin=JOBS_HOME_KEYWORD_HISTORY",
        "Cookie": (
            'li_at=AQEDAT016UkA2kzbAAABnLWy_BEAAAGc_ezafU0AlJzVvGiK12ZA31iSjRc_fVVqyAoZOHw_s57X0XOROjRy9Y5LZ8yOhEigz300TMqb3jU97Ae__KqZptySEb1bCH-CV2rwXZbwqxWmLY4keK9ds2qC; '
            'JSESSIONID="ajax:2777072973261931503"; '
            'bcookie="v=2&06a00d93-90e5-4ec0-8bee-f68d7c1c1d9f"'
        ),
        "Sec-Fetch-Dest": "empty",
        "Sec-Fetch-Mode": "cors",
        "Sec-Fetch-Site": "same-origin",
        "Pragma": "no-cache",
        "Cache-Control": "no-cache",
        "TE": "trailers",
    }

    # ---- Public API ------------------------------------------------------

    def fetch(
            self,
            save_json: bool = True,
            output_path: str = "raw_linkedin_response.json",
    ) -> LinkedInSearchResponse:
        raw = self._http_get()
        data = json.loads(raw)

        if save_json:
            script_dir = os.path.dirname(os.path.abspath(__file__))
            full_path = os.path.join(script_dir, output_path)

            with open(full_path, "w", encoding="utf-8") as f:
                json.dump(data, f, indent=4, ensure_ascii=False)

            print(f"[INFO] Saved raw JSON response to {full_path}")
            print(f"[INFO] Saved raw JSON response to {output_path}")

        return self._parse(data)

    def fetch_from_file(self, path: str) -> LinkedInSearchResponse:
        with open(path, "r", encoding="utf-8") as fh:
            data = json.load(fh)
        return self._parse(data)

    # ---- Private helpers -------------------------------------------------

    def _http_get(self) -> str:
        req = urllib.request.Request(self.URL, headers=self.HEADERS)
        try:
            with urllib.request.urlopen(req, timeout=15) as resp:
                raw_bytes = resp.read()
                try:
                    return gzip.decompress(raw_bytes).decode("utf-8")
                except OSError:
                    return raw_bytes.decode("utf-8")
        except urllib.error.HTTPError as exc:
            raise RuntimeError(
                f"LinkedIn API returned HTTP {exc.code}: {exc.reason}. "
                "Your session cookies may have expired."
            ) from exc

    def _parse(self, data: dict) -> LinkedInSearchResponse:
        root = data.get("data", data)
        metadata = root.get("metadata", {})
        paging = root.get("paging", {})
        included: list[dict] = data.get("included", [])

        postings_by_urn: dict[str, dict] = {}
        cards_by_urn: dict[str, dict] = {}
        companies_by_urn: dict[str, dict] = {}
        geos_by_urn: dict[str, dict] = {}

        for item in included:
            urn = item.get("entityUrn", "")
            item_type = item.get("$type", "")

            if item_type == "com.linkedin.voyager.dash.jobs.JobPosting":
                postings_by_urn[urn] = item
            elif item_type == "com.linkedin.voyager.dash.jobs.JobPostingCard" and "JOBS_SEARCH" in urn:
                cards_by_urn[urn] = item
            elif item_type == "com.linkedin.voyager.dash.organization.Company":
                companies_by_urn[urn] = item
            elif item_type == "com.linkedin.voyager.dash.common.Geo":
                geos_by_urn[urn] = item

        ordered_card_urns: list[str] = []
        for element in root.get("elements", []):
            ref = element.get("jobCardUnion", {}).get("*jobPostingCard")
            if ref:
                ordered_card_urns.append(ref)

        jobs: list[LinkedInJobCard] = []
        seen: set[str] = set()

        for card_urn in ordered_card_urns:
            card = cards_by_urn.get(card_urn)
            if not card:
                continue
            jobs.append(self._card_to_dataclass(card, postings_by_urn, companies_by_urn))
            seen.add(card_urn)

        for card_urn, card in cards_by_urn.items():
            if card_urn not in seen:
                jobs.append(self._card_to_dataclass(card, postings_by_urn, companies_by_urn))

        location = self._extract_search_location(metadata, geos_by_urn)

        meta = JobSearchMetadata(
            keywords=metadata.get("keywords"),
            location=location,
            total_results=int(paging.get("total", 0) or 0),
            start=int(paging.get("start", 0) or 0),
            count=int(paging.get("count", len(jobs)) or len(jobs)),
        )

        return LinkedInSearchResponse(metadata=meta, jobs=jobs)

    def _card_to_dataclass(
            self,
            card: dict,
            postings_by_urn: dict[str, dict],
            companies_by_urn: dict[str, dict],
    ) -> LinkedInJobCard:
        job_posting_urn = card.get("*jobPosting") or card.get("jobPostingUrn")
        posting = postings_by_urn.get(job_posting_urn or "", {})

        company_name = self._text(card.get("primaryDescription"))
        location = self._text(card.get("secondaryDescription"))
        company_url = self._get_company_url(card)
        company_logo_url = self._get_company_logo_url(card, companies_by_urn)

        company = Company(
            name=company_name,
            linkedin_url=company_url,
            logo_url=company_logo_url,
            verified=bool(card.get("*jobPostingVerification")),
        )

        return LinkedInJobCard(
            job_id=self._extract_job_id(card.get("entityUrn")) or self._extract_job_id(job_posting_urn),
            title=card.get("jobPostingTitle") or self._text(card.get("title")),
            location=location,
            company=company,
            job_posting_urn=card.get("jobPostingUrn") or job_posting_urn,
            normalized_job_posting_urn=card.get("preDashNormalizedJobPostingUrn"),
            reposted=posting.get("repostedJob"),
            content_source=posting.get("contentSource"),
        )

    @staticmethod
    def _extract_search_location(metadata: dict, geos_by_urn: dict[str, dict]) -> Optional[str]:
        geo_urn = metadata.get("*geo") or metadata.get("geoUrn")
        geo = geos_by_urn.get(geo_urn or "", {})
        return geo.get("fullLocalizedName") or geo.get("defaultLocalizedName")

    @staticmethod
    def _extract_job_id(urn: Optional[str]) -> Optional[str]:
        if not urn:
            return None
        if "(" in urn and "," in urn:
            return urn.split("(", 1)[1].split(",", 1)[0]
        return urn.rsplit(":", 1)[-1]

    @staticmethod
    def _text(obj: Optional[dict]) -> Optional[str]:
        if not obj:
            return None
        text = obj.get("text")
        if text is None:
            return None
        return text.replace("\xa0", " ").strip()

    @staticmethod
    def _get_company_url(card: dict) -> Optional[str]:
        logo = card.get("logo") or {}
        return logo.get("actionTarget")

    @classmethod
    def _get_company_logo_url(cls, card: dict, companies_by_urn: dict[str, dict]) -> Optional[str]:
        logo = card.get("logo") or {}
        attributes = logo.get("attributes") or []

        for attr in attributes:
            detail_union = attr.get("detailDataUnion") or {}
            company_urn = detail_union.get("companyLogo")
            if not company_urn:
                continue

            company = companies_by_urn.get(company_urn, {})
            vector = (company.get("logo") or {}).get("vectorImage")
            url = cls._vector_image_to_url(vector)
            if url:
                return url

        return None

    @staticmethod
    def _vector_image_to_url(vector_image: Optional[dict]) -> Optional[str]:
        if not vector_image:
            return None

        root_url = vector_image.get("rootUrl")
        artifacts = vector_image.get("artifacts") or []
        if not root_url or not artifacts:
            return None

        best = max(
            artifacts,
            key=lambda artifact: (artifact.get("width", 0), artifact.get("height", 0)),
        )
        path = best.get("fileIdentifyingUrlPathSegment")
        if not path:
            return None

        return f"{root_url}{path}"


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    scraper = LinkedInJobsScraper()

    print("Fetching LinkedIn jobs...")
    print(
        "NOTE: Session cookies expire quickly.\n"
        "      If you get HTTP 401/403, capture a fresh curl from your browser.\n"
    )

    try:
        result = scraper.fetch()
    except RuntimeError as e:
        print(f"[ERROR] {e}")
        raise SystemExit(1)

    print(result)

    print(f"\nTotal parsed jobs: {len(result.jobs)}")

    remote_python = [
        job for job in result.jobs
        if (job.title and "python" in job.title.lower())
           and (job.location and "remote" in job.location.lower())
    ]

    if remote_python:
        print(f"\n{'═' * 60}")
        print(f"  Remote Python jobs ({len(remote_python)} found):")
        print(f"{'═' * 60}")
        for job in remote_python:
            company_name = job.company.name if job.company and job.company.name else "Unknown company"
            print(f"  • {job.title} @ {company_name}  —  {job.linkedin_url}")

    reposted = [job for job in result.jobs if job.reposted]
    print(f"\n  Reposted jobs: {len(reposted)} / {len(result.jobs)}")

    with_company_page = [
        job for job in result.jobs
        if job.company and job.company.linkedin_url
    ]
    print(f"  Jobs with company page URL: {len(with_company_page)} / {len(result.jobs)}")
