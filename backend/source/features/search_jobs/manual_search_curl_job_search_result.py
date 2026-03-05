"""
LinkedIn Jobs Scraper
Hardcoded curl request converted to a Python class.
Produces structured JobPosting dataclasses as output.
"""

import json
import gzip
import urllib.request
import urllib.error
from dataclasses import dataclass, field
from typing import Optional
from datetime import datetime


# ---------------------------------------------------------------------------
# Dataclass definitions
# ---------------------------------------------------------------------------

@dataclass
class JobPosting:
    job_id: str
    title: str
    company: str
    location: str
    work_type: str  # Remote / On-site / Hybrid
    salary: Optional[str]
    posted_at: Optional[datetime]
    easy_apply: bool
    promoted: bool
    reposted: bool
    content_source: str  # JOBS_PREMIUM / JOBS_PREMIUM_OFFLINE / JOBS_CREATE
    applicant_signal: Optional[str]  # e.g. "Early applicant", "Be an early applicant"
    reviewer_signal: Optional[str]  # e.g. "Actively reviewing applicants"
    relevance_insight: Optional[str]  # e.g. "28 school alumni work here"
    budget_exhausted: bool  # True when encryptedBiddingParameters == BUDGET_EXHAUSTED_JOB
    linkedin_url: str

    def __str__(self) -> str:
        posted = self.posted_at.strftime("%b %d, %Y") if self.posted_at else "Unknown"
        lines = [
            f"{'─' * 60}",
            f"  {self.title}",
            f"  {self.company}  |  {self.location}  |  {self.work_type}",
            f"  Posted : {posted}",
        ]
        if self.salary:
            lines.append(f"  Salary : {self.salary}")
        flags = []
        if self.easy_apply:   flags.append("Easy Apply")
        if self.promoted:     flags.append("Promoted")
        if self.reposted:     flags.append("Reposted")
        if self.budget_exhausted: flags.append("Budget Exhausted")
        if flags:
            lines.append(f"  Flags  : {', '.join(flags)}")
        if self.applicant_signal:
            lines.append(f"  Signal : {self.applicant_signal}")
        if self.reviewer_signal:
            lines.append(f"  Review : {self.reviewer_signal}")
        if self.relevance_insight:
            lines.append(f"  Why    : {self.relevance_insight}")
        lines.append(f"  Source : {self.content_source}")
        lines.append(f"  URL    : {self.linkedin_url}")
        return "\n".join(lines)


@dataclass
class JobSearchResult:
    total_results: int
    page_start: int
    page_count: int
    jobs: list[JobPosting] = field(default_factory=list)

    def __str__(self) -> str:
        header = (
            f"\n{'═' * 60}\n"
            f"  LinkedIn Job Search Results\n"
            f"  Total: {self.total_results:,}  |  "
            f"Showing {self.page_start + 1}–{self.page_start + len(self.jobs)}\n"
            f"{'═' * 60}"
        )
        return header + "\n" + "\n".join(str(j) for j in self.jobs)


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

    # ---- Hardcoded request parameters ----------------------------------------

    URL = (
        "https://www.linkedin.com/voyager/api/voyagerJobsDashJobCards"
        "?decorationId=com.linkedin.voyager.dash.deco.jobs.search"
        ".JobSearchCardsCollection-220"
        "&count=25"
        "&q=jobSearch"
        "&query=(origin:JOB_SEARCH_PAGE_JOB_FILTER,"
        "selectedFilters:(timePostedRange:List(r604800)),"
        "spellCorrectionEnabled:true)"
        "&start=25"
    )

    HEADERS = {
        "User-Agent": (
            "Mozilla/5.0 (X11; Linux x86_64; rv:147.0) "
            "Gecko/20100101 Firefox/147.0"
        ),
        "Accept": "application/vnd.linkedin.normalized+json+2.1",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "gzip, deflate, br, zstd",
        "x-li-lang": "en_US",
        "x-li-track": (
            '{"clientVersion":"1.13.42613","mpVersion":"1.13.42613",'
            '"osName":"web","timezoneOffset":-3,"timezone":"America/Fortaleza",'
            '"deviceFormFactor":"DESKTOP","mpName":"voyager-web",'
            '"displayDensity":1,"displayWidth":1920,"displayHeight":1080}'
        ),
        "x-li-page-instance": (
            "urn:li:page:d_flagship3_search_srp_jobs;"
            "+qnA20BTT7qK2juHfJrXRA=="
        ),
        "csrf-token": "ajax:2777072973261931503",
        "x-restli-protocol-version": "2.0.0",
        "x-li-pem-metadata": (
            "Voyager - Careers - Jobs Search=jobs-search-results,"
            "Voyager - Careers - Critical - careers-api=jobs-search-results"
        ),
        "x-li-prefetch": "1",
        "Alt-Used": "www.linkedin.com",
        "Connection": "keep-alive",
        "Referer": (
            "https://www.linkedin.com/jobs/search/"
            "?currentJobId=4378839371&f_TPR=r604800"
            "&origin=JOB_SEARCH_PAGE_JOB_FILTER"
        ),
        "Cookie": (
            'bcookie="v=2&06a00d93-90e5-4ec0-8bee-f68d7c1c1d9f"; '
            'bscookie="v=1&202602091233361bc29369-d82d-4513-8c0c-bde03df081a2'
            'AQHxsH3xoCuk4BmYRXnlfBaz8McjnZz8"; '
            'li_rm=AQGiGtBE_pOr3QAAAZxCZKYNd-Xu0HyppOttaOUvQNmZ-HWvMBthXFn'
            'WKpDy4UAtwUCcBtootY5AtrQ5DBeflbr7zSxUbcaUodrjOwAbPF1a9CAPGKH7dTWl; '
            'g_state={"i_l":0}; '
            'timezone=America/Fortaleza; '
            'li_theme=system; '
            'li_theme_set=user; '
            'JSESSIONID="ajax:2777072973261931503"; '
            'li_at=AQEDAT016UkA2kzbAAABnLWy_BEAAAGc2b-AEU0AeCarHPFpq8noGEAS'
            'tRJiOmwuKQEhik6SrxpIxyFGN0CDlXsf1Bv8dH3N9Te5KKMgZl3cwU3BAH8an'
            'P3HvWie6d5i5XVPwhaWCCKeGMIOQEZ_ydxq; '
            'liap=true; '
            'lidc="b=VB05:s=V:r=V:a=V:p=V:g=7980:u=391:x=1:i=1772668398:'
            't=1772754798:v=2:sig=AQFCOPU3psMoS0I_oN11bfCUZ6gbi2_e"; '
            'lang=v=2&lang=en-us'
        ),
        "Sec-Fetch-Dest": "empty",
        "Sec-Fetch-Mode": "cors",
        "Sec-Fetch-Site": "same-origin",
        "Pragma": "no-cache",
        "Cache-Control": "no-cache",
    }

    # ---- Public API ----------------------------------------------------------

    def fetch(self) -> JobSearchResult:
        """Perform the HTTP request and return a JobSearchResult."""
        raw = self._http_get()
        data = json.loads(raw)
        return self._parse(data)

    def fetch_from_file(self, path: str) -> JobSearchResult:
        """Parse a locally saved JSON response (useful for offline dev/testing)."""
        with open(path, "r", encoding="utf-8") as fh:
            data = json.load(fh)
        return self._parse(data)

    # ---- Private helpers -----------------------------------------------------

    def _http_get(self) -> str:
        req = urllib.request.Request(self.URL, headers=self.HEADERS)
        try:
            with urllib.request.urlopen(req, timeout=15) as resp:
                raw_bytes = resp.read()
                # urllib decompresses gzip automatically when Accept-Encoding
                # is set, but handle both cases defensively.
                try:
                    return gzip.decompress(raw_bytes).decode("utf-8")
                except OSError:
                    return raw_bytes.decode("utf-8")
        except urllib.error.HTTPError as exc:
            raise RuntimeError(
                f"LinkedIn API returned HTTP {exc.code}: {exc.reason}. "
                "Your session cookies may have expired."
            ) from exc

    def _parse(self, data: dict) -> JobSearchResult:
        root = data.get("data", data)  # top-level may or may not have "data" key
        paging = root.get("paging", {})
        included: list[dict] = data.get("included", [])

        # Build lookup maps from the "included" array
        job_postings: dict[str, dict] = {}  # entityUrn -> posting dict
        job_cards: dict[str, dict] = {}  # entityUrn (JOBS_SEARCH) -> card dict

        for item in included:
            etype = item.get("$type", "")
            urn = item.get("entityUrn", "")
            if etype == "com.linkedin.voyager.dash.jobs.JobPosting":
                job_postings[urn] = item
            elif (
                    etype == "com.linkedin.voyager.dash.jobs.JobPostingCard"
                    and "JOBS_SEARCH" in urn
            ):
                job_cards[urn] = item

        jobs: list[JobPosting] = []
        for card_urn, card in job_cards.items():
            jobs.append(self._card_to_dataclass(card, job_postings))

        # Preserve LinkedIn ordering via the elements array
        elements = root.get("elements", [])
        ordered_urns = []
        for el in elements:
            cu = el.get("jobCardUnion", {})
            ref = cu.get("*jobPostingCard", "")
            if ref:
                ordered_urns.append(ref)

        ordered: list[JobPosting] = []
        for urn in ordered_urns:
            card = job_cards.get(urn)
            if card:
                ordered.append(self._card_to_dataclass(card, job_postings))

        # Fall back to unordered if ordering failed
        final_jobs = ordered if ordered else jobs

        return JobSearchResult(
            total_results=paging.get("total", 0),
            page_start=paging.get("start", 0),
            page_count=paging.get("count", 25),
            jobs=final_jobs,
        )

    @staticmethod
    def _card_to_dataclass(card: dict, postings: dict) -> JobPosting:
        # ---- IDs ----
        card_urn = card.get("entityUrn", "")
        job_id = card_urn.split("(")[1].split(",")[0] if "(" in card_urn else card_urn
        posting_urn = card.get("*jobPosting") or card.get("jobPostingUrn", "")
        posting = postings.get(posting_urn, {})

        # ---- Title ----
        title = (
                card.get("jobPostingTitle")
                or LinkedInJobsScraper._text(card.get("title"))
                or "Unknown"
        )

        # ---- Company ----
        company = LinkedInJobsScraper._text(card.get("primaryDescription")) or "Unknown"

        # ---- Location / work type ----
        loc_text = LinkedInJobsScraper._text(card.get("secondaryDescription")) or ""
        work_type = "Remote" if "Remote" in loc_text else (
            "On-site" if "On-site" in loc_text else "Hybrid"
        )
        location = loc_text.replace("(Remote)", "").replace("(On-site)", "").strip().rstrip(",")

        # ---- Salary ----
        salary = LinkedInJobsScraper._text(card.get("tertiaryDescription"))

        # ---- Dates ----
        posted_at: Optional[datetime] = None
        for footer in card.get("footerItems", []):
            if footer.get("type") == "LISTED_DATE":
                ts_ms = footer.get("timeAt")
                if ts_ms:
                    posted_at = datetime.utcfromtimestamp(ts_ms / 1000)
                break

        # ---- Flags from footerItems ----
        footer_types = {f.get("type") for f in card.get("footerItems", [])}
        easy_apply = "EASY_APPLY_TEXT" in footer_types
        promoted = "PROMOTED" in footer_types

        # ---- Applicant / reviewer signals ----
        applicant_signal: Optional[str] = None
        for footer in card.get("footerItems", []):
            if footer.get("type") == "APPLICANT_COUNT_TEXT":
                applicant_signal = LinkedInJobsScraper._text(footer.get("text"))
                break

        reviewer_signal: Optional[str] = None
        relevance_text: Optional[str] = None
        insight = card.get("relevanceInsight")
        if insight:
            relevance_text = LinkedInJobsScraper._text(insight.get("text"))
            # Distinguish reviewer signals from alumni/connection signals
            if relevance_text and any(
                    kw in relevance_text
                    for kw in ("review", "Actively", "applicant")
            ):
                reviewer_signal = relevance_text
                relevance_text = None  # not a relevance insight if it's a reviewer note

        # ---- Reposted ----
        reposted = posting.get("repostedJob", False)

        # ---- Content source ----
        content_source = posting.get("contentSource", "UNKNOWN")

        # ---- Budget exhausted ----
        budget_exhausted = (
                card.get("encryptedBiddingParameters") == "BUDGET_EXHAUSTED_JOB"
        )

        # ---- LinkedIn URL ----
        linkedin_url = f"https://www.linkedin.com/jobs/view/{job_id}"

        return JobPosting(
            job_id=job_id,
            title=title,
            company=company,
            location=location,
            work_type=work_type,
            salary=salary,
            posted_at=posted_at,
            easy_apply=easy_apply,
            promoted=promoted,
            reposted=reposted,
            content_source=content_source,
            applicant_signal=applicant_signal,
            reviewer_signal=reviewer_signal,
            relevance_insight=relevance_text,
            budget_exhausted=budget_exhausted,
            linkedin_url=linkedin_url,
        )

    @staticmethod
    def _text(obj: Optional[dict]) -> Optional[str]:
        """Safely extract the 'text' field from a LinkedIn text view-model."""
        if not obj:
            return None
        return obj.get("text") or None


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

    # Pretty-print the result
    print(result)

    # --- Example: filter remote Python jobs ---
    python_remote = [
        j for j in result.jobs
        if "python" in j.title.lower() and j.work_type == "Remote"
    ]
    if python_remote:
        print(f"\n{'═' * 60}")
        print(f"  Remote Python jobs ({len(python_remote)} found):")
        print('═' * 60)
        for j in python_remote:
            print(f"  • {j.title} @ {j.company}  —  {j.linkedin_url}")

    # --- Example: show only Easy Apply jobs ---
    easy = [j for j in result.jobs if j.easy_apply]
    print(f"\n  Easy Apply jobs: {len(easy)} / {len(result.jobs)}")

    # --- Example: show budget-exhausted organic listings ---
    organic = [j for j in result.jobs if j.budget_exhausted]
    print(f"  Budget-exhausted (now organic): {len(organic)} / {len(result.jobs)}")
