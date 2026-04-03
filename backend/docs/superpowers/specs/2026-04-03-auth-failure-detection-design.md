# Auth Failure Detection — Design Spec

**Date:** 2026-04-03  
**Status:** Approved  
**Scope:** SSE enrichment loop early-exit on LinkedIn session expiry

---

## Problem

When the LinkedIn auth token expires, LinkedIn returns a 302 redirect on Voyager API calls.
`requests` follows the redirect to an HTML login page (200 HTML). The JSON parse then fails,
raising `NonRetryableEnrichmentError`, which `BatchEnrichmentService.enrich_job()` silently
swallows (returning seed data). The enrichment loop continues, firing an unauthenticated
LinkedIn request for every remaining job.

---

## Goal

Detect the first auth failure and stop the entire streaming pipeline immediately — no further
LinkedIn calls, no partial file writes, no spurious `result` SSE event. The frontend receives
a single `auth_error` event it can use to display a "token expired" message.

---

## Architecture

### 1. New exception: `AuthExpiredError`

**File:** `source/features/enrich_jobs/linkedin_http_job_enricher.py`

```python
class AuthExpiredError(NonRetryableEnrichmentError):
    """Raised when LinkedIn rejects the request due to an expired/invalid session."""
    pass
```

Inherits from `NonRetryableEnrichmentError`. The existing `except NonRetryableEnrichmentError: raise`
in `BatchEnrichmentService._with_backoff()` already passes it through without retry — no changes needed there.

---

### 2. Detection in `fetch_job_details`

**File:** `source/features/enrich_jobs/linkedin_http_job_enricher.py`

After `session.get()` returns, check `resp.history` for a 302 redirect before any JSON parsing:

```python
if resp.history and any(r.status_code in (301, 302) for r in resp.history):
    raise AuthExpiredError(
        operation=f"fetch_job_details({job_id})",
        status_code=302,
        message="Session expired — LinkedIn redirected to login",
    )
```

This fires unconditionally (regardless of `raise_on_failure`) because a redirect on a
Voyager API call is never recoverable by retry with the same token.

---

### 3. Propagation through `BatchEnrichmentService`

**File:** `source/features/enrich_jobs/linkedin_http_batch_enricher.py`

Add an explicit re-raise in `enrich_job()` **before** the generic `except Exception` that
currently swallows failures:

```python
except AuthExpiredError:
    raise  # never swallow — caller must abort the loop
except Exception as e:
    if self.return_seed_on_failure:
        ...  # unchanged
```

`enrich_base_jobs()` has no try/except, so `AuthExpiredError` bubbles naturally from
`enrich_job()` → `enrich_base_jobs()` → `_enrich_parsed_jobs_stream()`.

---

### 4. Loop termination in `_enrich_parsed_jobs_stream`

**File:** `source/features/search_jobs/job_search_service.py`

Wrap the `enrich_base_jobs` call to catch `AuthExpiredError`:

```python
try:
    enriched = self.batch_enricher.enrich_base_jobs(chunk)
except AuthExpiredError:
    yield "auth_error", {
        "step": "enriching",
        "message": "LinkedIn session expired. Please refresh your auth token.",
    }
    return  # stops this generator — no more LinkedIn calls
```

---

### 5. Outer stream termination in `search_jobs_stream`

**File:** `source/features/search_jobs/job_search_service.py`

Handle the `auth_error` event type in the for loop over `_enrich_parsed_jobs_stream`:

```python
elif event_type == "auth_error":
    yield {"type": "auth_error", **data}
    return  # stops outer stream — no partial saves, no result event
```

---

## Stop chain

```
fetch_job_details          → raises AuthExpiredError
  enrich_job               → re-raises (explicit except AuthExpiredError: raise)
    enrich_base_jobs       → bubbles up (no try/except)
      _enrich_parsed_jobs_stream → yields ("auth_error", ...) + return
        search_jobs_stream → yields {"type": "auth_error", ...} to SSE + return
          SSE controller   → emits {"type": "auth_error", "message": "..."} to frontend
```

No partial JSON files written. No further LinkedIn calls. No spurious `result` event.

---

## Files changed

| File | Change |
|------|--------|
| `source/features/enrich_jobs/linkedin_http_job_enricher.py` | Add `AuthExpiredError`; add redirect detection in `fetch_job_details` |
| `source/features/enrich_jobs/linkedin_http_batch_enricher.py` | Add `except AuthExpiredError: raise` in `enrich_job` |
| `source/features/search_jobs/job_search_service.py` | Handle `auth_error` in `_enrich_parsed_jobs_stream` and `search_jobs_stream` |

No changes to the SSE controller (`job_search_controller.py`) — it already forwards all event types.

---

## Out of scope

- Pre-flight auth check before starting enrichment
- Token refresh / re-authentication
- Frontend handling of the `auth_error` event
