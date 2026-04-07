from __future__ import annotations

import json
import os
import sys
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Iterable
from urllib.parse import parse_qsl, quote, unquote, urlsplit, urlunsplit, urlencode

# --- Add project root to path ---
project_root = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "", "..", "..", "..")
)
if project_root not in sys.path:
    sys.path.insert(0, project_root)

from database.database_connection import get_db_session
from models.fetch_models import FetchCurl
from source.features.fetch_curl.linkedin_http_client import (
    LinkedInClient,
    LinkedInRequest,
    perform_linkedin_request,
)


# =============================================================================
# REQUEST
# =============================================================================

class RawStringRequest(LinkedInRequest):
    def __init__(
            self,
            method: str,
            url: str,
            body_str: str,
            debug: bool = False,
            extra_headers: dict[str, str] | None = None,
    ):
        super().__init__(method, url, debug=debug)
        self.body_str = body_str
        if extra_headers:
            self._headers.update(extra_headers)

    def execute(self, session, timeout=15):
        merged_headers = session.headers.copy()
        merged_headers.update(self._headers)
        return perform_linkedin_request(
            session,
            method=self.method,
            url=self.url,
            headers=merged_headers,
            data=self.body_str.encode("utf-8") if self.body_str else None,
            timeout=timeout,
        )


# =============================================================================
# ENUMS
# =============================================================================

class SortBy(str, Enum):
    RELEVANCE = "R"
    DATE_POSTED = "DD"


class WorkType(str, Enum):
    ON_SITE = "1"
    REMOTE = "2"
    HYBRID = "3"


class DatePosted(str, Enum):
    PAST_24_HOURS = "r86400"
    PAST_WEEK = "r604800"
    PAST_MONTH = "r2592000"


class ExperienceLevel(str, Enum):
    INTERNSHIP = "1"
    ENTRY_LEVEL = "2"
    ASSOCIATE = "3"
    MID_SENIOR = "4"
    DIRECTOR = "5"
    EXECUTIVE = "6"


class JobType(str, Enum):
    FULL_TIME = "F"
    PART_TIME = "P"
    CONTRACT = "C"
    TEMPORARY = "T"
    VOLUNTEER = "V"
    INTERNSHIP = "I"
    OTHER = "O"


class SearchOrigin(str, Enum):
    JOBS_HOME_KEYWORD_HISTORY = "JOBS_HOME_KEYWORD_HISTORY"
    JOB_SEARCH_PAGE_JOB_FILTER = "JOB_SEARCH_PAGE_JOB_FILTER"


# =============================================================================
# SEARCH TUNING
# =============================================================================

@dataclass
class JobSearchTuning:
    current_job_id: str | int | None = None
    keywords: str | None = None
    geo_id: str | int | None = None
    distance: int | float | None = None

    sort_by: SortBy | None = None
    work_types: list[WorkType] = field(default_factory=list)
    date_posted: DatePosted | None = None
    experience_levels: list[ExperienceLevel] = field(default_factory=list)
    job_types: list[JobType] = field(default_factory=list)

    origin: SearchOrigin | str | None = None
    spell_correction_enabled: bool | None = None

    # Escape hatch caso você descubra outro filtro do Voyager depois
    # Ex.: {"easyApply": ["true"]} ou {"someNewFilter": ["X", "Y"]}
    custom_selected_filters: dict[str, Any] = field(default_factory=dict)

    # Campos top-level do query=(...) que não estão modelados ainda
    custom_query_fields: dict[str, Any] = field(default_factory=dict)


# =============================================================================
# FETCHER
# =============================================================================

class VoyagerJobsLiteFetcher:
    def __init__(
            self,
            page: int = 1,
            count: int | None = None,
            tuning: JobSearchTuning | None = None,
            debug: bool = False,
    ):
        if page < 1:
            raise ValueError("page must be >= 1")

        self.debug = debug
        self.page = page
        self.tuning = tuning or JobSearchTuning()
        self.client = LinkedInClient("JobCardsLite")

        if not self.client.config:
            raise ValueError("Configuração 'JobCardsLite' não encontrada no banco.")

        db = get_db_session()
        try:
            record = db.query(FetchCurl).filter(FetchCurl.name == "JobCardsLite").first()
            if not record:
                raise ValueError("Record 'JobCardsLite' not found in database.")

            self.original_url = record.base_url
            self.original_referer = record.referer or ""
            self.method = record.method or "GET"
            self.base_body_str = record.body or ""

            detected_count = self._extract_query_param_int(self.original_url, "count", default=7)
            self.count = count if count is not None else detected_count
            self.start = (self.page - 1) * self.count

            self.url = self._build_voyager_url(
                base_url=self.original_url,
                start=self.start,
                count=self.count,
                tuning=self.tuning,
            )

            self.browser_referer = self._build_browser_search_url(
                base_url=self.original_referer or "https://www.linkedin.com/jobs/search/",
                tuning=self.tuning,
            )
        finally:
            db.close()

    # -------------------------------------------------------------------------
    # Public fetch
    # -------------------------------------------------------------------------

    def fetch_raw(self) -> dict:
        req = RawStringRequest(
            method=self.method,
            url=self.url,
            body_str=self.base_body_str,
            debug=self.debug,
            extra_headers={"Referer": self.browser_referer} if self.browser_referer else None,
        )

        try:
            response = self.client.execute(req)

            if response.status_code == 400:
                raise RuntimeError(
                    "HTTP 400 — malformed Voyager query. "
                    "O problema mais provável é o bloco query=(...) ter ficado inválido."
                )

            if response.status_code in (401, 403):
                raise RuntimeError(
                    f"HTTP {response.status_code} — cookies / csrf provavelmente expirados."
                )

            if response.status_code != 200:
                raise RuntimeError(f"HTTP {response.status_code}")

            content_type = response.headers.get("Content-Type", "")
            raw_body = response.content.decode("utf-8", errors="replace")

            if "application/octet-stream" in content_type:
                return {"rsc_dump": raw_body}

            clean_text = raw_body.lstrip()
            if clean_text.startswith(")]}'"):
                clean_text = clean_text.split("\n", 1)[-1]

            return json.loads(clean_text)

        except ImportError:
            raise
        except Exception as exc:
            try:
                from source.features.enrich_jobs.linkedin_http_job_enricher import AuthExpiredError
            except ImportError:
                AuthExpiredError = None

            if AuthExpiredError and isinstance(exc, AuthExpiredError):
                raise
            raise RuntimeError(f"Failed to fetch JobCardsLite data: {exc}") from exc

    # -------------------------------------------------------------------------
    # Build URL helpers
    # -------------------------------------------------------------------------

    @staticmethod
    def _extract_query_param_int(url: str, param_name: str, default: int) -> int:
        parsed = urlsplit(url)
        params = dict(parse_qsl(parsed.query, keep_blank_values=True))
        raw_value = params.get(param_name)
        if raw_value is None:
            return default

        try:
            return int(float(raw_value))
        except (TypeError, ValueError):
            return default

    @staticmethod
    def _split_top_level(text: str, delimiter: str = ",") -> list[str]:
        text = text.strip()
        if not text:
            return []

        parts: list[str] = []
        depth = 0
        current: list[str] = []

        for ch in text:
            if ch == "(":
                depth += 1
            elif ch == ")":
                depth -= 1

            if ch == delimiter and depth == 0:
                piece = "".join(current).strip()
                if piece:
                    parts.append(piece)
                current = []
                continue

            current.append(ch)

        last_piece = "".join(current).strip()
        if last_piece:
            parts.append(last_piece)

        return parts

    @classmethod
    def _parse_record(cls, text: str) -> dict[str, str]:
        text = text.strip()
        if not text:
            return {}

        if text.startswith("(") and text.endswith(")"):
            text = text[1:-1].strip()

        if not text:
            return {}

        data: dict[str, str] = {}
        for item in cls._split_top_level(text):
            if ":" not in item:
                continue
            key, value = item.split(":", 1)
            data[key.strip()] = value.strip()

        return data

    @staticmethod
    def _serialize_scalar(value: Any) -> str:
        if isinstance(value, Enum):
            return str(value.value)
        if isinstance(value, bool):
            return "true" if value else "false"
        return str(value)

    @classmethod
    def _render_list(cls, values: Iterable[Any]) -> str:
        serialized = ",".join(cls._serialize_scalar(v) for v in values)
        return f"List({serialized})"

    @staticmethod
    def _render_record(data: dict[str, str]) -> str:
        return "(" + ",".join(f"{key}:{value}" for key, value in data.items()) + ")"

    @staticmethod
    def _encode_keywords(value: str) -> str:
        # Garante que:
        # "Python NOT Estágio" -> "Python%20NOT%20Est%C3%A1gio"
        return quote(unquote(str(value)), safe="")

    @classmethod
    def _set_query_field(cls, query_fields: dict[str, str], key: str, value: Any) -> None:
        if value is None:
            return
        query_fields[key] = cls._serialize_scalar(value)

    @classmethod
    def _set_selected_filter(cls, selected_filters: dict[str, str], key: str, value: Any) -> None:
        if value is None:
            return

        # Permite já passar algo pronto, ex.: "List(1,2,3)"
        if isinstance(value, str) and value.startswith("List("):
            selected_filters[key] = value
            return

        if isinstance(value, (list, tuple, set)):
            values = list(value)
            if not values:
                return
            selected_filters[key] = cls._render_list(values)
            return

        selected_filters[key] = cls._render_list([value])

    @classmethod
    def _build_voyager_url(
            cls,
            base_url: str,
            start: int,
            count: int,
            tuning: JobSearchTuning,
    ) -> str:
        parsed = urlsplit(base_url)
        original_pairs = parse_qsl(parsed.query, keep_blank_values=True)

        top_level_params: list[tuple[str, str]] = []
        raw_query_value = ""

        for key, value in original_pairs:
            if key == "query":
                raw_query_value = value
                continue
            if key in {"start", "count"}:
                continue
            top_level_params.append((key, value))

        query_fields = cls._parse_record(raw_query_value)
        selected_filters = cls._parse_record(query_fields.get("selectedFilters", ""))

        # -------- top-level inside query=(...) --------
        if tuning.current_job_id is not None:
            query_fields["currentJobId"] = cls._serialize_scalar(tuning.current_job_id)

        if tuning.origin is not None:
            query_fields["origin"] = cls._serialize_scalar(tuning.origin)

        if tuning.keywords is not None:
            query_fields["keywords"] = cls._encode_keywords(tuning.keywords)
        elif "keywords" in query_fields:
            query_fields["keywords"] = cls._encode_keywords(query_fields["keywords"])

        if tuning.geo_id is not None:
            query_fields["locationUnion"] = f"(geoId:{cls._serialize_scalar(tuning.geo_id)})"

        if tuning.spell_correction_enabled is not None:
            query_fields["spellCorrectionEnabled"] = cls._serialize_scalar(
                tuning.spell_correction_enabled
            )

        for key, value in tuning.custom_query_fields.items():
            query_fields[key] = cls._serialize_scalar(value)

        # -------- selectedFilters:(...) --------
        if tuning.distance is not None:
            cls._set_selected_filter(selected_filters, "distance", tuning.distance)

        if tuning.work_types:
            cls._set_selected_filter(selected_filters, "workplaceType", tuning.work_types)

        if tuning.experience_levels:
            cls._set_selected_filter(selected_filters, "experience", tuning.experience_levels)

        if tuning.date_posted is not None:
            cls._set_selected_filter(selected_filters, "timePostedRange", tuning.date_posted)

        if tuning.sort_by is not None:
            cls._set_selected_filter(selected_filters, "sortBy", tuning.sort_by)

        if tuning.job_types:
            cls._set_selected_filter(selected_filters, "jobType", tuning.job_types)

        for key, value in tuning.custom_selected_filters.items():
            cls._set_selected_filter(selected_filters, key, value)

        if selected_filters:
            query_fields["selectedFilters"] = cls._render_record(selected_filters)
        else:
            query_fields.pop("selectedFilters", None)

        voyager_query_value = cls._render_record(query_fields)

        # Monta query string preservando os params originais e substituindo count/query/start
        final_parts: list[str] = []
        for key, value in top_level_params:
            final_parts.append(
                f"{quote(str(key), safe='')}={quote(str(value), safe='-._~')}"
            )

        final_parts.append(f"count={count}")
        final_parts.append(f"query={voyager_query_value}")
        final_parts.append(f"start={start}")

        final_query_string = "&".join(final_parts)

        return urlunsplit(
            (
                parsed.scheme,
                parsed.netloc,
                parsed.path,
                final_query_string,
                parsed.fragment,
            )
        )

    @classmethod
    def _build_browser_search_url(
            cls,
            base_url: str,
            tuning: JobSearchTuning,
    ) -> str:
        parsed = urlsplit(base_url)
        params = dict(parse_qsl(parsed.query, keep_blank_values=True))

        if tuning.current_job_id is not None:
            params["currentJobId"] = cls._serialize_scalar(tuning.current_job_id)

        if tuning.distance is not None:
            params["distance"] = cls._serialize_scalar(tuning.distance)

        if tuning.geo_id is not None:
            params["geoId"] = cls._serialize_scalar(tuning.geo_id)

        if tuning.keywords is not None:
            params["keywords"] = str(tuning.keywords)

        if tuning.origin is not None:
            params["origin"] = cls._serialize_scalar(tuning.origin)

        if tuning.sort_by is not None:
            params["sortBy"] = cls._serialize_scalar(tuning.sort_by)

        if tuning.work_types:
            params["f_WT"] = ",".join(cls._serialize_scalar(v) for v in tuning.work_types)

        if tuning.experience_levels:
            params["f_E"] = ",".join(
                cls._serialize_scalar(v) for v in tuning.experience_levels
            )

        if tuning.date_posted is not None:
            params["f_TPR"] = cls._serialize_scalar(tuning.date_posted)

        if tuning.job_types:
            params["f_JT"] = ",".join(cls._serialize_scalar(v) for v in tuning.job_types)

        # Remove vazios
        clean_params = {k: v for k, v in params.items() if v not in ("", None)}

        return urlunsplit(
            (
                parsed.scheme or "https",
                parsed.netloc or "www.linkedin.com",
                parsed.path or "/jobs/search/",
                urlencode(clean_params, doseq=True),
                parsed.fragment,
            )
        )


# =============================================================================
# PUBLIC API
# =============================================================================

def fetch_and_save(
        page: int = 1,
        count: int | None = None,
        tuning: JobSearchTuning | None = None,
        debug: bool = False,
        save_json: bool = True,
) -> dict:
    """
    Fetch LinkedIn GraphQL payload.

    Modes:
    - save_json=True  → saves file (CLI/debug mode)
    - save_json=False → pure in-memory mode (service/API)
    """

    fetcher = VoyagerJobsLiteFetcher(
        page=page,
        count=count,
        tuning=tuning,
        debug=debug,
    )

    data = fetcher.fetch_raw()

    if save_json:
        script_dir = os.path.dirname(os.path.abspath(__file__))
        output_path = os.path.join(script_dir, "linkedin_graphql_response.json")

        with open(output_path, "w", encoding="utf-8") as fh:
            json.dump(data, fh, indent=2, ensure_ascii=False)

        print(f"✅ Successfully saved response to: {output_path}")

    print(f"Resolved count={fetcher.count}, start={fetcher.start}")
    print(f"Final Voyager URL: {fetcher.url}")
    print(f"Final Browser Referer: {fetcher.browser_referer}")

    return data


# =============================================================================
# CONFIG
# =============================================================================

if __name__ == "__main__":
    PAGE = 1
    COUNT = 50
    DEBUG = False

    SEARCH = JobSearchTuning(
        current_job_id="4381764035",
        keywords="Python NOT Estágio NOT Junior NOT Senior",
        geo_id="106057199",
        distance=25.0,

        # Se quiser replicar EXATAMENTE a URL que você mandou, use RELEVANCE.
        # Se quiser ordenar por data, troque para DATE_POSTED.
        sort_by=SortBy.RELEVANCE,

        work_types=[WorkType.REMOTE],
        experience_levels=[
            ExperienceLevel.INTERNSHIP,
            ExperienceLevel.ENTRY_LEVEL,
            ExperienceLevel.ASSOCIATE,
        ],
        date_posted=DatePosted.PAST_WEEK,

        origin=SearchOrigin.JOB_SEARCH_PAGE_JOB_FILTER,
        spell_correction_enabled=True,
    )

    print("Fetching GraphQL JOB_DETAILS prefetch using DB config...")
    print(f"Page: {PAGE}")

    try:
        fetch_and_save(
            page=PAGE,
            count=COUNT,
            tuning=SEARCH,
            debug=DEBUG,
        )
    except Exception as e:
        print(f"❌ [ERROR] {e}")
        raise SystemExit(1)
