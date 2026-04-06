# Swagger Blueprint Inventory

## Scope
This inventory is based on the actual Flask blueprint registrations in [app.py](/home/mateus/Desktop/Javascript/linkedin-scrapper/backend/app.py), not just on folder names under `source/features`.

It covers only registered blueprints. Internal modules, helpers, services, parsers, and unregistered feature folders are intentionally excluded from the main inventory and handled separately in notes.

## Registered Blueprints Overview

| Blueprint | URL Prefix | Current File(s) | Router/Controller Split | Swagger Status | Endpoint Count | Recommended Action | Priority Batch |
|---|---|---|---|---|---:|---|---|
| `fetch_curl` | `/config` | `source/features/fetch_curl/__init__.py`, `source/features/fetch_curl/fetch_controller.py` | No | undocumented | 7 declared handlers | skip for now | Batch 3 |
| `jobs` | `/jobs` | `source/features/job_population/job_controller.py` | No | undocumented | 7 | document as-is | Batch 2 |
| `job_population` | `/pipeline` | `source/features/job_population/population_controller.py` | No | undocumented | 3 | document as-is | Batch 2 |
| `resumes` | `/resumes` | `source/features/resume/resume_data.py` | No | undocumented | 6 | document as-is | Batch 1 |
| `profiles` | `/profiles` | `source/features/profile/profile_controller.py` | No | undocumented | 7 | document as-is | Batch 1 |
| `services` | `/services` | `source/features/get_applied_jobs/services_router.py`, `source/features/get_applied_jobs/applied_jobs_controller.py` | Yes | documented | 7 | skip for now | Batch 3 |
| `gmail` | `/emails` | `source/features/gmail_service/gmail_controller.py` | No | undocumented | 3 | document as-is | Batch 2 |
| `connections` | `/connections` | `source/features/friends_connections/connections_controller.py` | No | undocumented | 5 | document as-is | Batch 3 |
| `job_tracker` | `/job-tracker` | `source/features/get_applied_jobs/applied_jobs_controller.py` | No dedicated router file | undocumented | 7 | split first | Batch 3 |
| `search_jobs` | `/search-jobs` | `source/features/search_jobs/job_search_controller.py` | No dedicated router file, but already thin-controller style | undocumented | 4 | split first | Batch 1 |

## Blueprint Details

### 1. `fetch_curl`
- Blueprint name: `fetch_curl`
- URL prefix: `/config`
- Current file(s):
  - `source/features/fetch_curl/__init__.py`
  - `source/features/fetch_curl/fetch_controller.py`
- Router/controller split: No
- Swagger status: undocumented
- Endpoint count: 7 declared route handlers
- Endpoints:
  - `GET /config/curl/<string:name>`
  - `PUT /config/curl/<string:name>`
  - `GET|PUT|DELETE /config/pagination-curl`
  - `GET|PUT|DELETE /config/individual-job-curl`
  - `GET|PUT|DELETE /config/curl/<string:name>`
  - `GET|PUT|DELETE /config/experience`
  - `GET /config/profile/<string:vanity_name>/<string:config_name>`
- Recommended action: skip for now
- Priority batch: Batch 3
- Notes:
  - This blueprint has overlapping route declarations for `/config/curl/<string:name>`.
  - It mixes raw body handling, JSON body handling, and alias-style config endpoints.
  - It should be documented only after route behavior is verified and normalized enough to avoid misleading Swagger output.

### 2. `jobs`
- Blueprint name: `jobs`
- URL prefix: `/jobs`
- Current file(s):
  - `source/features/job_population/job_controller.py`
- Router/controller split: No
- Swagger status: undocumented
- Endpoint count: 7
- Endpoints:
  - `GET /jobs/`
  - `GET /jobs/all`
  - `GET /jobs/keywords-stream`
  - `PATCH /jobs/<string:urn>`
  - `PATCH /jobs/<string:urn>/disable`
  - `PATCH /jobs/<string:urn>/mark_applied`
  - `POST /jobs/match-score`
- Recommended action: document as-is
- Priority batch: Batch 2
- Notes:
  - This blueprint contains both simple JSON endpoints and one SSE endpoint.
  - The JSON endpoints can be documented first; the stream endpoint should get lighter documentation later.

### 3. `job_population`
- Blueprint name: `job_population`
- URL prefix: `/pipeline`
- Current file(s):
  - `source/features/job_population/population_controller.py`
- Router/controller split: No
- Swagger status: undocumented
- Endpoint count: 3
- Endpoints:
  - `GET /pipeline/get-total-pages`
  - `GET /pipeline/fetch-page/<int:page_number>`
  - `GET /pipeline/backfill-descriptions-stream`
- Recommended action: document as-is
- Priority batch: Batch 2
- Notes:
  - Two endpoints are straightforward.
  - The stream endpoint should not receive a heavy example payload at first.

### 4. `resumes`
- Blueprint name: `resumes`
- URL prefix: `/resumes`
- Current file(s):
  - `source/features/resume/resume_data.py`
- Router/controller split: No
- Swagger status: undocumented
- Endpoint count: 6
- Endpoints:
  - `POST /resumes/`
  - `GET /resumes/<int:resume_id>`
  - `GET /resumes/`
  - `PUT /resumes/<int:resume_id>`
  - `DELETE /resumes/<int:resume_id>`
  - `POST /resumes/tailor`
- Recommended action: document as-is
- Priority batch: Batch 1
- Notes:
  - Strong candidate for early Swagger coverage because CRUD behavior is stable and easy to describe.
  - `POST /resumes/tailor` is more complex, but still synchronous JSON and suitable for early documentation.

### 5. `profiles`
- Blueprint name: `profiles`
- URL prefix: `/profiles`
- Current file(s):
  - `source/features/profile/profile_controller.py`
- Router/controller split: No
- Swagger status: undocumented
- Endpoint count: 7
- Endpoints:
  - `POST /profiles/`
  - `GET /profiles/`
  - `GET /profiles/<int:profile_id>`
  - `PUT /profiles/<int:profile_id>`
  - `DELETE /profiles/<int:profile_id>`
  - `PATCH /profiles/<int:profile_id>/smtp-password`
  - `POST /profiles/<int:profile_id>/test-smtp`
- Recommended action: document as-is
- Priority batch: Batch 1
- Notes:
  - Most of this blueprint is simple CRUD.
  - `smtp-password` and `test-smtp` should be documented carefully and may deserve more conservative examples.

### 6. `services`
- Blueprint name: `services`
- URL prefix: `/services`
- Current file(s):
  - `source/features/get_applied_jobs/services_router.py`
  - `source/features/get_applied_jobs/applied_jobs_controller.py`
- Router/controller split: Yes
- Swagger status: documented
- Endpoint count: 7
- Endpoints:
  - `GET /services/applied`
  - `GET /services/applied-live`
  - `GET /services/saved-live`
  - `GET /services/debug-job`
  - `POST /services/sync-applied`
  - `GET /services/sync-applied-backfill-stream`
  - `POST /services/sync-applied-smart`
- Recommended action: skip for now
- Priority batch: Batch 3
- Notes:
  - This is the reference implementation for the Swagger pattern.
  - It already demonstrates the intended router/controller split and Flasgger docstring style.
  - Use this blueprint as the primary template for future work.

### 7. `gmail`
- Blueprint name: `gmail`
- URL prefix: `/emails`
- Current file(s):
  - `source/features/gmail_service/gmail_controller.py`
- Router/controller split: No
- Swagger status: undocumented
- Endpoint count: 3
- Endpoints:
  - `POST /emails/sync`
  - `POST /emails/reconcile-backlog`
  - `GET /emails/`
- Recommended action: document as-is
- Priority batch: Batch 2
- Notes:
  - The listing endpoint is straightforward.
  - The sync endpoints are operational and should be documented with care around side effects.

### 8. `connections`
- Blueprint name: `connections`
- URL prefix: `/connections`
- Current file(s):
  - `source/features/friends_connections/connections_controller.py`
- Router/controller split: No
- Swagger status: undocumented
- Endpoint count: 5
- Endpoints:
  - `GET /connections/`
  - `GET /connections/sync`
  - `POST /connections/reset-one`
  - `POST /connections/reset-bugged`
  - `POST /connections/refresh-profile`
- Recommended action: document as-is
- Priority batch: Batch 3
- Notes:
  - This blueprint includes operational and SSE-style behavior.
  - It should come after simpler CRUD and stable JSON surfaces.

### 9. `job_tracker`
- Blueprint name: `job_tracker`
- URL prefix: `/job-tracker`
- Current file(s):
  - `source/features/get_applied_jobs/applied_jobs_controller.py`
- Router/controller split: No dedicated router file
- Swagger status: undocumented
- Endpoint count: 7
- Endpoints:
  - `GET /job-tracker/applied`
  - `GET /job-tracker/applied-live`
  - `GET /job-tracker/saved-live`
  - `GET /job-tracker/debug-job`
  - `POST /job-tracker/sync-applied`
  - `GET /job-tracker/sync-applied-backfill-stream`
  - `POST /job-tracker/sync-applied-smart`
- Recommended action: split first
- Priority batch: Batch 3
- Notes:
  - This is the best direct candidate for adopting the same pattern already used by `/services`.
  - It overlaps conceptually with the already-documented `/services` surface.
  - Before writing Swagger docs, decide whether `/job-tracker` is meant to remain a separate public API surface.

### 10. `search_jobs`
- Blueprint name: `search_jobs`
- URL prefix: `/search-jobs`
- Current file(s):
  - `source/features/search_jobs/job_search_controller.py`
- Router/controller split: No dedicated router file, but controller is already thin and router-like
- Swagger status: undocumented
- Endpoint count: 4
- Endpoints:
  - `GET|POST /search-jobs/live`
  - `GET|POST /search-jobs/live/stream`
  - `GET|POST /search-jobs/debug-live`
  - `GET /search-jobs/options`
- Recommended action: split first
- Priority batch: Batch 1
- Notes:
  - This is the strongest rollout candidate after the existing `/services` example.
  - The controller already mostly contains request parsing and delegation, so extracting a dedicated router file should be low-risk later.
  - `live` and `options` should be documented before `live/stream`.

## Reference Template Files
The best source files to copy from later are:
- `source/features/get_applied_jobs/services_router.py`
- `source/features/get_applied_jobs/applied_jobs_controller.py`
- `source/features/search_jobs/job_search_controller.py`

## Non-Blueprint / Internal Feature Folders
These folders exist under `source/features` but are not registered blueprints in `app.py` and should not be treated as public API documentation targets right now:
- `api_fetch`
- `enrich_jobs`
- `get_network_details`
- `jobs`
- `playwright_scrapper`

## Batch 1
Focus on stable or near-ready surfaces with the highest documentation payoff.
- `search_jobs`
  - Split first.
  - Document `options`, `live`, and `debug-live` first.
  - Defer detailed `live/stream` examples.
- `profiles`
  - Document as-is.
- `resumes`
  - Document as-is.

## Batch 2
Cover stable JSON endpoints and medium-complexity operational endpoints.
- `jobs`
  - Document JSON endpoints first.
  - Add light docs for `keywords-stream` later.
- `job_population`
  - Document simple endpoints first.
  - Keep SSE documentation minimal.
- `gmail`
  - Document `GET /emails/` first.
  - Then operational sync endpoints.

## Batch 3
Handle duplicates, operational tools, and volatile or overlapping routes.
- `job_tracker`
  - Split first.
  - Reassess overlap with `/services` before documenting everything.
- `connections`
  - Document as-is.
- `fetch_curl`
  - Skip until route overlap and request-shape behavior are clarified.
- `services`
  - Already documented; use as the template and baseline only.

## Validation Notes For Later Implementation
- Prefer container-first validation if the backend is already running in Docker.
- If no container is running, validate through the project’s Docker/Poetry environment, not the bare host.
- Safe checks after future documentation work:
  - confirm the app imports cleanly
  - confirm `/apispec_1.json` builds
  - confirm `/apidocs/` renders
  - smoke-test representative documented endpoints
- Current environment note:
  - direct host-side app import failed during inspection because the active host Python environment does not currently have the Flask dependency set available.
