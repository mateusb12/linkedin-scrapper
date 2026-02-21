import asyncio
import json
import re
import zlib
from pathlib import Path
from playwright.async_api import async_playwright


class LinkedInSniffer:
    """
    Sniffer OOP para capturar responses do LinkedIn.
    Suporta SDUI, GraphQL, JSON, streams, gzip e fallback hex.
    Persistência real via launch_persistent_context.
    """

    def __init__(
            self,
            search_terms,
            target_url,
            user_data_dir="linkedin_profile",
            hits_dir="sniffer_hits",
            regex_mode=False
    ):
        self.search_terms = search_terms
        self.target_url = target_url
        self.regex_mode = regex_mode

        self.user_data_dir = Path(user_data_dir)
        self.hits_dir = Path(hits_dir)

        self.user_data_dir.mkdir(exist_ok=True)
        self.hits_dir.mkdir(exist_ok=True)

        self.playwright = None
        self.context = None
        self.page = None


    @staticmethod
    def try_decode(body: bytes) -> str:
        """Decodifica JSON, SDUI ou stream em múltiplos formatos."""

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

        try:
            return body.hex()
        except:
            return ""

    @staticmethod
    def pretty_format(text: str) -> str:
        """Se for JSON, indentá-lo."""
        try:
            parsed = json.loads(text)
            return json.dumps(parsed, indent=2, ensure_ascii=False)
        except:
            return text


    def matches(self, text: str) -> bool:
        """Verifica se algum termo alvo aparece na resposta."""
        for term in self.search_terms:
            if self.regex_mode:
                if re.search(term, text, re.IGNORECASE):
                    return True
            else:
                if term.lower() in text.lower():
                    return True
        return False


    async def handle_response(self, response):
        url = response.url

        if not any(k in url for k in ["experience", "graphql", "voyager", "sdui"]):
            return

        try:
            body = await response.body()
        except:
            return

        decoded = self.try_decode(body)
        if not decoded:
            return

        if self.matches(decoded):
            print("\n" + "=" * 70)
            print("[HIT] Termo encontrado!")
            print("URL:", url)
            print("Status:", response.status)
            print("Método:", response.request.method)
            print("=" * 70)

            safe_name = (
                url.replace("/", "_")
                .replace(":", "_")
                .replace("?", "_")
                .replace("&", "_")
            )

            filename = self.hits_dir / f"hit_{safe_name}.txt"

            with filename.open("w", encoding="utf-8", errors="ignore") as f:
                f.write("=== REQUEST HEADERS ===\n")
                for k, v in response.request.headers.items():
                    f.write(f"{k}: {v}\n")

                f.write("\n=== RESPONSE HEADERS ===\n")
                for k, v in response.headers.items():
                    f.write(f"{k}: {v}\n")

                f.write("\n=== BODY ===\n\n")
                f.write(self.pretty_format(decoded))

            print(f"[SALVO] {filename}\n")


    async def setup_browser(self):
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

        self.page = (
            self.context.pages[0] if self.context.pages else await self.context.new_page()
        )

        print(f"[PROFILE] Usando perfil persistente: {self.user_data_dir}")


    def setup_listeners(self):
        self.page.on("response", self.handle_response)


    async def start(self):
        await self.setup_browser()
        self.setup_listeners()

        print("[SNIFFER] Termos alvo:", self.search_terms)
        print("[PAGE] Acessando:", self.target_url)

        await self.page.goto(self.target_url)

        print("[INFO] Se pedir login, faça APENAS uma vez. Persistência está ativa.")
        print("[INFO] Sniffer rodando… navegue normalmente.\n")

        await asyncio.sleep(999999)



if __name__ == "__main__":
    sniffer = LinkedInSniffer(
        search_terms=[
            "Otimizei drones",
            "Otimizei",
            "drones",
            "otimizei drones"
        ],
        target_url="https://www.linkedin.com/in/me/details/experience/",
        regex_mode=False
    )

    asyncio.run(sniffer.start())
