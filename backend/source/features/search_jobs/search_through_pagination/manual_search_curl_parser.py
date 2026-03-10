"""
Parser-only module for LinkedIn job search results.

Reads raw_linkedin_response.json and converts it into structured dataclasses
based on the actual search-card payload structure.

No HTTP requests here.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional


# ---------------------------------------------------------------------------
# Reusable small models
# ---------------------------------------------------------------------------

@dataclass
class TextValue:
    text: Optional[str] = None
    text_direction: Optional[str] = None
    accessibility_text: Optional[str] = None


@dataclass
class ImageAttribute:
    company_logo_urn: Optional[str] = None


@dataclass
class ImageView:
    action_target: Optional[str] = None
    accessibility_text: Optional[str] = None
    attribute: Optional[ImageAttribute] = None


@dataclass
class VectorArtifact:
    width: int = 0
    height: int = 0
    path_segment: Optional[str] = None
    expires_at: Optional[int] = None


@dataclass
class VectorImage:
    root_url: Optional[str] = None
    artifacts: list[VectorArtifact] = field(default_factory=list)

    def best_url(self) -> Optional[str]:
        if not self.root_url or not self.artifacts:
            return None

        best = max(self.artifacts, key=lambda a: (a.width, a.height))
        if not best.path_segment:
            return None

        return f"{self.root_url}{best.path_segment}"


@dataclass
class Paging:
    total: int = 0
    start: int = 0
    count: int = 0


@dataclass
class SearchElement:
    job_posting_card_urn: str


# ---------------------------------------------------------------------------
# Raw LinkedIn entity dataclasses
# ---------------------------------------------------------------------------

@dataclass
class Company:
    entity_urn: str
    logo: Optional[VectorImage] = None

    @property
    def logo_url(self) -> Optional[str]:
        return self.logo.best_url() if self.logo else None


@dataclass
class JobPosting:
    entity_urn: str
    tracking_urn: Optional[str] = None
    title: Optional[str] = None
    reposted_job: Optional[bool] = None
    content_source: Optional[str] = None
    poster_id: Optional[str] = None


@dataclass
class JobPostingVerification:
    entity_urn: str
    control_name: Optional[str] = None
    lego_tracking_token: Optional[str] = None
    badge_system_image: Optional[str] = None


@dataclass
class JobPostingCard:
    entity_urn: str
    job_posting_urn: Optional[str] = None
    normalized_job_posting_urn: Optional[str] = None
    verification_urn: Optional[str] = None
    job_posting_title: Optional[str] = None

    title: Optional[TextValue] = None
    primary_description: Optional[TextValue] = None
    secondary_description: Optional[TextValue] = None
    logo: Optional[ImageView] = None

    blurred: Optional[bool] = None


@dataclass
class JobSearchMetadata:
    keywords: Optional[str] = None
    location: Optional[str] = None
    total_results: int = 0
    start: int = 0
    count: int = 0

    origin: Optional[str] = None
    geo_urn: Optional[str] = None
    title: Optional[TextValue] = None
    subtitle: Optional[TextValue] = None
    reference_id: Optional[str] = None


# ---------------------------------------------------------------------------
# Resolved job model
# ---------------------------------------------------------------------------

@dataclass
class ResolvedLinkedInJob:
    card: JobPostingCard
    posting: Optional[JobPosting] = None
    company: Optional[Company] = None
    verification: Optional[JobPostingVerification] = None

    @property
    def job_id(self) -> Optional[str]:
        return LinkedInSearchParser._extract_job_id(
            self.card.job_posting_urn
            or self.card.normalized_job_posting_urn
            or self.card.entity_urn
        )

    @property
    def linkedin_url(self) -> Optional[str]:
        return f"https://www.linkedin.com/jobs/view/{self.job_id}" if self.job_id else None

    @property
    def title(self) -> Optional[str]:
        return (
                self.card.job_posting_title
                or (self.card.title.text if self.card.title else None)
                or (self.posting.title if self.posting else None)
        )

    @property
    def primary_description(self) -> Optional[str]:
        return self.card.primary_description.text if self.card.primary_description else None

    @property
    def secondary_description(self) -> Optional[str]:
        return self.card.secondary_description.text if self.card.secondary_description else None

    @property
    def company_name(self) -> Optional[str]:
        return self.primary_description

    @property
    def location(self) -> Optional[str]:
        return self.secondary_description

    @property
    def logo_urn(self) -> Optional[str]:
        if not self.card.logo or not self.card.logo.attribute:
            return None
        return self.card.logo.attribute.company_logo_urn

    @property
    def company_logo_url(self) -> Optional[str]:
        return self.company.logo_url if self.company else None

    @property
    def company_linkedin_url(self) -> Optional[str]:
        return self.card.logo.action_target if self.card.logo else None

    @property
    def reposted_job(self) -> Optional[bool]:
        return self.posting.reposted_job if self.posting else None

    @property
    def content_source(self) -> Optional[str]:
        return self.posting.content_source if self.posting else None

    @property
    def tracking_urn(self) -> Optional[str]:
        return self.posting.tracking_urn if self.posting else None

    @property
    def is_verified(self) -> bool:
        return self.verification is not None

    @property
    def verification_control_name(self) -> Optional[str]:
        return self.verification.control_name if self.verification else None


@dataclass
class LinkedInSearchResponse:
    metadata: JobSearchMetadata = field(default_factory=JobSearchMetadata)
    paging: Paging = field(default_factory=Paging)
    elements: list[SearchElement] = field(default_factory=list)
    jobs: list[ResolvedLinkedInJob] = field(default_factory=list)

    # Optional: keep raw collections if you want to inspect them later
    cards_by_urn: dict[str, JobPostingCard] = field(default_factory=dict)
    postings_by_urn: dict[str, JobPosting] = field(default_factory=dict)
    companies_by_urn: dict[str, Company] = field(default_factory=dict)
    verifications_by_urn: dict[str, JobPostingVerification] = field(default_factory=dict)


# ---------------------------------------------------------------------------
# Parser
# ---------------------------------------------------------------------------

class LinkedInSearchParser:
    def parse_file(self, path: str | Path) -> LinkedInSearchResponse:
        with Path(path).open("r", encoding="utf-8") as f:
            data = json.load(f)
        return self.parse_dict(data)

    def parse_dict(self, data: dict) -> LinkedInSearchResponse:
        root = data.get("data", data)
        metadata = root.get("metadata", {})
        paging = root.get("paging", {})
        included = data.get("included") or root.get("included") or []

        postings_by_urn: dict[str, JobPosting] = {}
        cards_by_urn: dict[str, JobPostingCard] = {}
        companies_by_urn: dict[str, Company] = {}
        verifications_by_urn: dict[str, JobPostingVerification] = {}
        geos_by_urn: dict[str, dict] = {}

        for item in included:
            urn = item.get("entityUrn", "")
            item_type = item.get("$type", "")

            if item_type == "com.linkedin.voyager.dash.jobs.JobPosting":
                posting = self._parse_job_posting(item)
                postings_by_urn[posting.entity_urn] = posting

            elif item_type == "com.linkedin.voyager.dash.jobs.JobPostingCard" and "JOBS_SEARCH" in urn:
                card = self._parse_job_posting_card(item)
                cards_by_urn[card.entity_urn] = card

            elif item_type == "com.linkedin.voyager.dash.organization.Company":
                company = self._parse_company(item)
                companies_by_urn[company.entity_urn] = company

            elif item_type == "com.linkedin.voyager.dash.jobs.JobPostingVerification":
                verification = self._parse_job_posting_verification(item)
                verifications_by_urn[verification.entity_urn] = verification

            elif item_type == "com.linkedin.voyager.dash.common.Geo":
                geos_by_urn[urn] = item

        elements: list[SearchElement] = []
        ordered_card_urns: list[str] = []

        for element in root.get("elements", []):
            ref = (element.get("jobCardUnion") or {}).get("*jobPostingCard")
            if ref:
                elements.append(SearchElement(job_posting_card_urn=ref))
                ordered_card_urns.append(ref)

        jobs: list[ResolvedLinkedInJob] = []
        seen: set[str] = set()

        for card_urn in ordered_card_urns:
            card = cards_by_urn.get(card_urn)
            if not card:
                continue

            jobs.append(
                self._resolve_job(
                    card=card,
                    postings_by_urn=postings_by_urn,
                    companies_by_urn=companies_by_urn,
                    verifications_by_urn=verifications_by_urn,
                )
            )
            seen.add(card_urn)

        for card_urn, card in cards_by_urn.items():
            if card_urn in seen:
                continue

            jobs.append(
                self._resolve_job(
                    card=card,
                    postings_by_urn=postings_by_urn,
                    companies_by_urn=companies_by_urn,
                    verifications_by_urn=verifications_by_urn,
                )
            )

        return LinkedInSearchResponse(
            metadata=JobSearchMetadata(
                keywords=metadata.get("keywords"),
                location=self._extract_search_location(metadata, geos_by_urn),
                total_results=int(paging.get("total", 0) or 0),
                start=int(paging.get("start", 0) or 0),
                count=int(paging.get("count", len(jobs)) or len(jobs)),
                origin=metadata.get("origin"),
                geo_urn=metadata.get("*geo") or metadata.get("geoUrn"),
                title=self._parse_text(metadata.get("title")),
                subtitle=self._parse_text(metadata.get("subtitle")),
                reference_id=metadata.get("referenceId"),
            ),
            paging=Paging(
                total=int(paging.get("total", 0) or 0),
                start=int(paging.get("start", 0) or 0),
                count=int(paging.get("count", len(jobs)) or len(jobs)),
            ),
            elements=elements,
            jobs=jobs,
            cards_by_urn=cards_by_urn,
            postings_by_urn=postings_by_urn,
            companies_by_urn=companies_by_urn,
            verifications_by_urn=verifications_by_urn,
        )

    def _resolve_job(
            self,
            card: JobPostingCard,
            postings_by_urn: dict[str, JobPosting],
            companies_by_urn: dict[str, Company],
            verifications_by_urn: dict[str, JobPostingVerification],
    ) -> ResolvedLinkedInJob:
        logo_urn = None
        if card.logo and card.logo.attribute:
            logo_urn = card.logo.attribute.company_logo_urn

        return ResolvedLinkedInJob(
            card=card,
            posting=postings_by_urn.get(card.job_posting_urn or ""),
            company=companies_by_urn.get(logo_urn or ""),
            verification=verifications_by_urn.get(card.verification_urn or ""),
        )

    def _parse_job_posting(self, item: dict) -> JobPosting:
        return JobPosting(
            entity_urn=item.get("entityUrn", ""),
            tracking_urn=item.get("trackingUrn"),
            title=item.get("title"),
            reposted_job=self._bool_or_none(item.get("repostedJob")),
            content_source=item.get("contentSource"),
            poster_id=item.get("posterId"),
        )

    def _parse_job_posting_verification(self, item: dict) -> JobPostingVerification:
        badge = item.get("badge") or {}
        badge_system_image = None

        for attr in badge.get("attributes", []):
            detail_union = attr.get("detailDataUnion") or {}
            system_image = detail_union.get("systemImage")
            if system_image:
                badge_system_image = system_image
                break

        return JobPostingVerification(
            entity_urn=item.get("entityUrn", ""),
            control_name=item.get("controlName"),
            lego_tracking_token=item.get("legoTrackingToken"),
            badge_system_image=badge_system_image,
        )

    def _parse_job_posting_card(self, item: dict) -> JobPostingCard:
        return JobPostingCard(
            entity_urn=item.get("entityUrn", ""),
            job_posting_urn=item.get("*jobPosting") or item.get("jobPostingUrn"),
            normalized_job_posting_urn=item.get("preDashNormalizedJobPostingUrn"),
            verification_urn=item.get("*jobPostingVerification") or item.get("jobPostingVerificationUrn"),
            job_posting_title=item.get("jobPostingTitle"),
            title=self._parse_text(item.get("title")),
            primary_description=self._parse_text(item.get("primaryDescription")),
            secondary_description=self._parse_text(item.get("secondaryDescription")),
            logo=self._parse_image_view(item.get("logo")),
            blurred=self._bool_or_none(item.get("blurred")),
        )

    def _parse_company(self, item: dict) -> Company:
        return Company(
            entity_urn=item.get("entityUrn", ""),
            logo=self._parse_vector_image((item.get("logo") or {}).get("vectorImage")),
        )

    @classmethod
    def _parse_text(cls, obj: Optional[dict]) -> Optional[TextValue]:
        if not obj:
            return None

        return TextValue(
            text=cls._normalize_text(obj.get("text")),
            text_direction=obj.get("textDirection"),
            accessibility_text=obj.get("accessibilityText"),
        )

    @staticmethod
    def _parse_image_view(obj: Optional[dict]) -> Optional[ImageView]:
        if not obj:
            return None

        company_logo_urn = None
        for attr in obj.get("attributes", []):
            detail_union = attr.get("detailDataUnion") or {}
            if detail_union.get("companyLogo"):
                company_logo_urn = detail_union["companyLogo"]
                break

        return ImageView(
            action_target=obj.get("actionTarget"),
            accessibility_text=obj.get("accessibilityText"),
            attribute=ImageAttribute(company_logo_urn=company_logo_urn),
        )

    @staticmethod
    def _parse_vector_image(vector_image: Optional[dict]) -> Optional[VectorImage]:
        if not vector_image:
            return None

        artifacts: list[VectorArtifact] = []
        for artifact in vector_image.get("artifacts") or []:
            artifacts.append(
                VectorArtifact(
                    width=int(artifact.get("width", 0) or 0),
                    height=int(artifact.get("height", 0) or 0),
                    path_segment=artifact.get("fileIdentifyingUrlPathSegment"),
                    expires_at=artifact.get("expiresAt"),
                )
            )

        return VectorImage(
            root_url=vector_image.get("rootUrl"),
            artifacts=artifacts,
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
    def _normalize_text(value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        return value.replace("\xa0", " ").strip()

    @staticmethod
    def _bool_or_none(value: object) -> Optional[bool]:
        if value is None:
            return None
        return bool(value)


def parse_raw_linkedin_response(path: str | Path) -> LinkedInSearchResponse:
    return LinkedInSearchParser().parse_file(path)


if __name__ == "__main__":
    path = Path(__file__).with_name("raw_linkedin_response.json")
    result = parse_raw_linkedin_response(path)

    print(f"Total results: {result.metadata.total_results}")
    print(f"Showing: {result.metadata.start + 1} - {result.metadata.start + len(result.jobs)}")
    print(f"Keywords: {result.metadata.keywords}")
    print(f"Location: {result.metadata.location}")
    print()

    for job in result.jobs:
        print(f"TITLE: {job.title}")
        print(f"PRIMARY DESCRIPTION: {job.primary_description}")
        print(f"SECONDARY DESCRIPTION: {job.secondary_description}")
        print(f"LOGO URN: {job.logo_urn}")
        print(f"LOGO URL: {job.company_logo_url}")
        print(f"COMPANY PAGE: {job.company_linkedin_url}")
        print(f"JOB POSTING URN: {job.card.job_posting_urn}")
        print(f"NORMALIZED JOB URN: {job.card.normalized_job_posting_urn}")
        print(f"TRACKING URN: {job.tracking_urn}")
        print(f"REPOSTED: {job.reposted_job}")
        print(f"CONTENT SOURCE: {job.content_source}")
        print(f"VERIFIED: {job.is_verified}")
        print(f"VERIFICATION CONTROL: {job.verification_control_name}")
        print(f"LINKEDIN URL: {job.linkedin_url}")
        print("-" * 80)
