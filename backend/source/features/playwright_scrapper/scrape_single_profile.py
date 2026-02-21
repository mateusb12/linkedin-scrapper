import asyncio
import html
import json
import re
import zlib
from pathlib import Path

from playwright.async_api import (
    Error as PlaywrightError,
    Page,
    BrowserContext,
    async_playwright,
)


def structure_profile_data(raw_list: list[str]) -> dict:
    sections = ["Experience", "Education", "Licenses & certifications", "Skills", "About", "Languages",
                "Recommendations"]
    structured = {s: [] for s in sections}
    structured["About"] = ""

    noise_patterns = [
        r"^\$L\w+", r"^Show all$", r"^Endorse$", r"^Recommend", r"^Activity$",
        r"followers$", r"no recent posts$", r"Nothing to see", r"^Follow$",
        r"^Join$", r"^Subscribe$", r"^Cancel$", r"^Unfollow$", r"· \d[snrt][dt][h]$"
    ]

    clean_list = []
    active_skip = True  
    in_interests = False

    for item in raw_list:
        item = item.strip()
        if item == "Interests": in_interests = True
        if in_interests and item in sections and item != "Interests": in_interests = False

        if item in sections: active_skip = False

        if active_skip or in_interests: continue

        if any(re.search(p, item) for p in noise_patterns) or "Please try again" in item:
            continue

        clean_list.append(item)

    current_section = None
    date_pattern = r"(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s\d{4}\s-\s(Present|\w+\s\d{4})"
    i = 0

    while i < len(clean_list):
        item = clean_list[i]

        if item in sections:
            current_section = item
            i += 1
            continue

        if not current_section:
            i += 1
            continue

        if current_section == "Experience":
            found_date_idx = -1
            for offset in range(3):
                if i + offset < len(clean_list) and re.search(date_pattern, clean_list[i + offset]):
                    found_date_idx = i + offset
                    break

            if found_date_idx != -1:
                role = clean_list[i] if found_date_idx > i else "Unknown Role"
                company = clean_list[i + 1] if found_date_idx > i + 1 else clean_list[i]

                company = company.split(" · ")[0] if " · " in company else company

                job = {
                    "role": role if role != company else "Position",
                    "company": company,
                    "period": clean_list[found_date_idx],
                    "location": clean_list[found_date_idx + 1] if found_date_idx + 1 < len(clean_list) and (
                            "," in clean_list[found_date_idx + 1] or "Remote" in clean_list[
                        found_date_idx + 1]) else "",
                    "description": []
                }

                next_ptr = found_date_idx + (2 if job["location"] else 1)

                while next_ptr < len(clean_list) and not re.search(date_pattern, clean_list[next_ptr]) and clean_list[
                    next_ptr] not in sections:
                    job["description"].append(clean_list[next_ptr])
                    next_ptr += 1

                job["description"] = "\n".join(job["description"])
                structured["Experience"].append(job)
                i = next_ptr
                continue

        if current_section == "Licenses & certifications":
            if i + 2 < len(clean_list) and "Issued" in clean_list[i + 2]:
                structured["Licenses & certifications"].append({
                    "name": clean_list[i],
                    "issuer": clean_list[i + 1],
                    "date": clean_list[i + 2],
                    "credential_id": clean_list[i + 3] if i + 3 < len(clean_list) and "ID" in clean_list[i + 3] else ""
                })
                i += 4 if (i + 3 < len(clean_list) and "ID" in clean_list[i + 3]) else 3
                continue

        if current_section == "About":
            structured["About"] += item + "\n"
        else:
            structured[current_section].append(item)

        i += 1

    structured["About"] = structured["About"].strip()
    return {k: v for k, v in structured.items() if v}


class LinkedInBrowserSniffer:
    """Base class: manages Playwright and response decoding."""

    def __init__(self, target_url: str, user_data_dir: str = "linkedin_profile") -> None:
        self.target_url = target_url
        self.user_data_dir = Path(user_data_dir)
        self.user_data_dir.mkdir(exist_ok=True)

        self.playwright = None
        self.context: BrowserContext | None = None
        self.page: Page | None = None
        self.pool_texts: list[str] = []
        self._processed = False

    async def setup_browser(self) -> None:
        self.playwright = await async_playwright().start()
        self.context = await self.playwright.chromium.launch_persistent_context(
            user_data_dir=str(self.user_data_dir),
            headless=False,
            slow_mo=30,
            ignore_https_errors=True,
            args=["--disable-web-security"],
            user_agent=(
                "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
                "(KHTML, like Gecko) Chrome/123 Safari/537.36"
            ),
        )
        self.page = self.context.pages[0] if self.context.pages else await self.context.new_page()

    async def goto_target(self) -> None:
        assert self.page is not None
        await self.page.goto(self.target_url)

    async def close(self) -> None:
        if self.context:
            await self.context.close()
        if self.playwright:
            await self.playwright.stop()

    @staticmethod
    def try_decode(body: bytes) -> str:
        """Try common encodings/compressions used by responses."""
        try:
            return body.decode("utf-8")
        except Exception:
            pass

        try:
            return zlib.decompress(body, zlib.MAX_WBITS | 16).decode("utf-8")
        except Exception:
            pass

        try:
            return zlib.decompress(body).decode("utf-8")
        except Exception:
            pass

        return ""

    async def handle_response(self, response):
        raise NotImplementedError

    def setup_listeners(self) -> None:
        assert self.page is not None
        self.page.on("response", self.handle_response)

    def extract_data(self) -> None:
        raise NotImplementedError


class ProfileScraper(LinkedInBrowserSniffer):
    """Single-profile extractor (saves to JSON)."""

    async def handle_response(self, response):
        url = response.url
        is_target_payload = (
                "api/identity/profiles" in url or
                "profileCards" in url or
                "member-relationship" in url
        )

        if not is_target_payload:
            return

        status = response.status
        print(f"[SNIFFER] Intercepted: {status} - {url}...")

        try:
            body_bytes = await response.body()
            decoded = self.try_decode(body_bytes)
            if decoded:
                self.pool_texts.append(decoded)
        except Exception as e:
            pass

    def extract_data(self) -> None:
        if self._processed:
            return
        self._processed = True

        if not self.pool_texts:
            print("[EMPTY] No relevant requests were captured.")
            return

        found_texts: list[str] = []

        for text in self.pool_texts:
            cleaned = html.unescape(text)
            patterns = [
                r'"text"\s*:\s*\[\s*"([^"]+)"\s*\]',
                r'"children"\s*:\s*\[\s*"([^"]+)"\s*\]',
                r'"summary"\s*:\s*"([^"]+)"',
                r'"headline"\s*:\s*"([^"]+)"',
            ]
            for pattern in patterns:
                found_texts.extend(re.findall(pattern, cleaned))

        junk = {
            "Show more", "See more", "Show credential", "logo", "Back", "Next", "•",
        }

        deduped: list[str] = []
        for t in found_texts:
            t_clean = t.strip().replace("\\n", "\n")
            if len(t_clean) < 2 or t_clean in junk:
                continue
            if not deduped or deduped[-1] != t_clean:
                deduped.append(t_clean)

        if not deduped:
            print("⚠️ No text extracted.")
            return

        print("\n" + "=" * 50)
        print("🕵️‍♂️ DEBUG: RAW EXTRACTED STRINGS (IN ORDER)")
        print("=" * 50)
        for i, text in enumerate(deduped):
            preview = text.replace('\n', ' ')[:80]
            print(f"[{i:03d}] {preview}{'...' if len(text) > 80 else ''}")
        print("=" * 50 + "\n")

        grouped = structure_profile_data(deduped)
        profile_data = {"url": self.target_url, "extracted_data": grouped}

        output_file = Path("mined_profiles.json")
        existing: list[dict] = []

        if output_file.exists():
            try:
                with output_file.open("r", encoding="utf-8") as f:
                    existing = json.load(f)
            except json.JSONDecodeError:
                existing = []

        existing.append(profile_data)

        with output_file.open("w", encoding="utf-8") as f:
            json.dump(existing, f, ensure_ascii=False, indent=4)

        print(f"✨ Success! Saved data to {output_file.name}")

    async def start(self) -> None:
        await self.setup_browser()
        self.setup_listeners()
        await self.goto_target()
        print("\n[INFO] 🕵️‍♂️ Sniffer active. Scroll the page, then press Stop (or CTRL+C) to extract.\n")
        await asyncio.sleep(999999)


async def run_scraper_instance(scraper: ProfileScraper) -> None:
    """Ensures safe shutdown and triggers extraction."""
    try:
        await scraper.start()
    except (asyncio.CancelledError, KeyboardInterrupt):
        print("\n[INFO] 🛑 Interrupt detected. Extracting data...")
        scraper.extract_data()
    finally:
        try:
            await scraper.close()
        except PlaywrightError:
            pass
        except Exception as exc:
            print(f"[WARN] Error while closing scraper: {exc}")


if __name__ == "__main__":
    TEST_URL = "https://www.linkedin.com/in/monicasbusatta/"
    print(f"Starting single-profile scraper for: {TEST_URL}")

    bot = ProfileScraper(target_url=TEST_URL)

    try:
        asyncio.run(run_scraper_instance(bot))
    except KeyboardInterrupt:
        print("\n[SYSTEM] Closed by user.")
