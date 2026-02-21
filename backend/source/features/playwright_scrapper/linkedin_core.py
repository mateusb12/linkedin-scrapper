import zlib
from pathlib import Path
from playwright.async_api import async_playwright, Page, BrowserContext


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
