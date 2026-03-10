"""
LinkedIn Jobs Scraper
Hardcoded curl request converted to a Python class.
Produces structured JobPosting dataclasses as output and saves raw JSON for inspection.
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
            'bcookie="v=2&06a00d93-90e5-4ec0-8bee-f68d7c1c1d9f"; '
            'bscookie="v=1&202602091233361bc29369-d82d-4513-8c0c-bde03df081a2AQHxsH3xoCuk4BmYRXnlfBaz8McjnZz8"; '
            'li_rm=AQGiGtBE_pOr3QAAAZxCZKYNd-Xu0HyppOttaOUvQNmZ-HWvMBthXFnWKpDy4UAtwUCcBtootY5AtrQ5DBeflbr7zSxUbcaUodrjOwAbPF1a9CAPGKH7dTWl; '
            'g_state={"i_l":0}; timezone=America/Fortaleza; li_theme=system; li_theme_set=user; '
            'UserMatchHistory=AQJ1rTP0PefV7wAAAZzUBM29E_Wl8rwR-yNCmDQsj8ouXPA1G6LezqFwcw8gKpzJH3ez8joU-ApYISapeu04zaygwf2GDLcF1fdhNO71_Jrm2KqoQtm3QlOaG0wBWL5PJp6TSYt6822gz830RE0bKL9WQeiexPJIe_TvRThoy1H9DlE4hCqeleq-yF8CY0nN7Z8JcAYqsaT6Sy5WZnjm9v-zKfTubIIn_FsmbBW_BFIqw6dYgn8Ho6LoiXoqwKkIipK0juXI48OPG7prwvoCJQ9VwhIuQ7WEU_K8rNNc2MtlpttcX_tn3RsrRnRqPNMdbUONuY1jLGYdrk_zBdqU; '
            'dfpfpt=77f99deb2144437ab82f05269fe4a036; sdui_ver=sdui-flagship:0.1.30243+SduiFlagship0; '
            '_pxvid=8e02eed5-05b3-11f1-855d-85f84338a619; visit=v=1&M; JSESSIONID="ajax:2777072973261931503"; '
            'li_at=AQEDAT016UkA2kzbAAABnLWy_BEAAAGc2b-AEU0AeCarHPFpq8noGEAStRJiOmwuKQEhik6SrxpIxyFGN0CDlXsf1Bv8dH3N9Te5KKMgZl3cwU3BAH8anP3HvWie6d5i5XVPwhaWCCKeGMIOQEZ_ydxq; '
            'liap=true; _px3=1624fe839c7acd99f3c112f0e23dfbf8e3b080bcdfcf8dfa5f8f75edf8f3f1c1:EIDoBXglSmkeqLKsg2pQmfcgP2LlQzIK10PZA9VAPMTR+5ZJMA37XJt6BTgqs8bEGDDCDbjtpxHycriqzflZIQ==:1000:Y3P9a3iPrB6BCFcjw4JloYBukj/c0R8drMig4QZ7A7H80ppWcGzkm50+h0Jr7c1ySjetyuoQMX+wYfO6KkmXlxUv8HBvRs48KXOpASK4nqb5M0UhF7S0HeeOqNxnSrkiGhn5Gxi8EckRsM8Oym8P6aNWSyjHUC8dHmkj86W8lTSNIR0xI9+yfxmJ5hoS8o0Ymkc7Oo1Ji+QBO9DYowXzMIKOXRWoPcqic4Qqip6BNz5Vftaxpn8qllzLO9MzBJhsLdfvHha33Ktwe+OJPWkdahPliv7N242bENLI33AI8bqyL5o4XYgnqjhNBXQJFWF8ST4dlLYPZsjvUY50MpoeIUnMlFjrFfXeeaKKtixlGwdtk5EsnudY75rvy8YNHiGc/dybms//GYR9HWh4KxL0/B2yGPjr7cF+loOs0YdyaLA7pzVYAmiw9tPho5pZEynl56x/3ZgwKAH79VYFw7VUVc9n3WO7g6IBYKAvXcp69r0mmKg5NFq3eb2YuDz5QHQt; '
            'lidc="b=VB05:s=V:r=V:a=V:p=V:g=7980:u=396:x=1:i=1773095765:t=1773182137:v=2:sig=AQEr4iKOh5EIYeEjC_f_HpzsNp8Y0tjl"; lang=v=2&lang=en-us; '
            '__cf_bm=djTdtkgequpbQZi3tlMz9SEP28icWRXnMBvURDL7Y6E-1773158625-1.0.1.1-TbxToDIIK.RCj9s6.7xZ1d3pYqsAxt94AaLbIbPfiqKBuInde9FgG3txoxUuYeM5WClRO_SMmNVoH9d5Rb9xezZBcrgfuGKdMooUGqEetCo; '
            'fptctx2=taBcrIH61PuCVH7eNCyH0FC0izOzUpX5wN2Z%252b5egc%252f53DRZaA4bKNdO9yJFow6lfKKgdq%252bxDje%252b9f9azVSoveqEn9i3koReTtGyAHcHqrEoymTsEmtmwZBeFFofyIfO4UFWpS7yUPmaKxxCuk3dT6HYDq4qw7xcGO2dBcHZPAi0XP9GPRZ%252blxItLrscVpNZoXth9youHknrlocTrlPPG7f0GpM8GDkGSRWdaMk1hQuZlbBaA%252fZMMIuypUyVs0%252bpxBhnczmhW69w8EYJzM3urRjQTiYFHyBtml1a3aRFPK1rROxjS00snOuU7JuXBLWTkRPKgUe1v%252bTRZJZwXA2cwJN%252fqbT8oDhyLhpaDi9j2Z%252bIwaIAyrYHrJ4zm3l%252fCPxxJAg9qSpgkCzL3ku28JTayVA%253d%253d'
        ),
        "Sec-Fetch-Dest": "empty",
        "Sec-Fetch-Mode": "cors",
        "Sec-Fetch-Site": "same-origin",
        "Pragma": "no-cache",
        "Cache-Control": "no-cache",
        "TE": "trailers"
    }

    # ---- Public API ----------------------------------------------------------

    def fetch(self, save_json: bool = True, output_path: str = "raw_linkedin_response.json") -> JobSearchResult:
        """Perform the HTTP request and return a JobSearchResult."""
        raw = self._http_get()
        data = json.loads(raw)

        # Save the raw output to a file so the structure can be examined
        if save_json:
            with open(output_path, "w", encoding="utf-8") as f:
                json.dump(data, f, indent=4, ensure_ascii=False)
            print(f"[INFO] Saved raw JSON response to {output_path}")

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
