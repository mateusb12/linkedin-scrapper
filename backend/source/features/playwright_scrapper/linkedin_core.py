import zlib
from pathlib import Path
from playwright.async_api import async_playwright, Page, BrowserContext


class LinkedInBrowserSniffer:
    """
    Classe Base: Gerencia o Playwright, contexto persistente e decodificação base do sniffer.
    """

    def __init__(self, target_url: str, user_data_dir: str = "linkedin_profile") -> None:
        self.target_url = target_url
        self.user_data_dir = Path(user_data_dir)
        self.user_data_dir.mkdir(exist_ok=True)

        self.playwright = None
        self.context: BrowserContext | None = None
        self.page: Page | None = None

        # Pool global onde os filhos vão guardar os dados interceptados
        self.pool_texts = []
        self._processed = False

    async def setup_browser(self) -> None:
        """Inicializa Playwright + contexto persistente + página."""
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
        print(f"[PROFILE] Usando perfil persistente: {self.user_data_dir}")

    async def goto_target(self) -> None:
        assert self.page is not None
        print("[PAGE] Acessando:", self.target_url)
        await self.page.goto(self.target_url)

    async def close(self) -> None:
        if self.context:
            await self.context.close()
        if self.playwright:
            await self.playwright.stop()

    @staticmethod
    def try_decode(body: bytes) -> str:
        """Tenta decodificar o payload das requisições."""
        try:
            return body.decode("utf-8")
        except:
            pass
        try:
            return zlib.decompress(body, zlib.MAX_WBITS | 16).decode("utf-8")
        except:
            pass
        try:
            return zlib.decompress(body).decode("utf-8")
        except:
            pass
        return ""

    async def handle_response(self, response):
        """Método abstrato: As classes filhas decidem QUAL url sniffar."""
        raise NotImplementedError("As classes filhas devem implementar o sniffer de response.")

    def setup_listeners(self):
        assert self.page is not None
        self.page.on("response", self.handle_response)

    def extract_data(self):
        """Método abstrato: As classes filhas processam a pool de textos aqui."""
        raise NotImplementedError("As classes filhas devem implementar a extração de dados.")
