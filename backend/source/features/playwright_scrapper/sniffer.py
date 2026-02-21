import asyncio
import json
import re
import zlib
from pathlib import Path
from typing import List, Dict

from playwright.async_api import async_playwright, Page, BrowserContext


class LinkedInBase:
    """
    Base para fluxos do LinkedIn usando Playwright.
    Gerencia:
      - perfil persistente (launch_persistent_context)
      - contexto / página
    """

    def __init__(
            self,
            target_url: str,
            user_data_dir: str = "linkedin_profile",
    ) -> None:
        self.target_url = target_url
        self.user_data_dir = Path(user_data_dir)
        self.user_data_dir.mkdir(exist_ok=True)

        self.playwright = None
        self.context: BrowserContext | None = None
        self.page: Page | None = None

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

        self.page = (
            self.context.pages[0] if self.context.pages else await self.context.new_page()
        )

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


class LinkedInSniffer(LinkedInBase):
    """
    Sniffer OOP para capturar responses do LinkedIn.
    Suporta SDUI, GraphQL, JSON, streams, gzip e fallback hex.
    """

    def __init__(
            self,
            search_terms: List[str],
            target_url: str,
            user_data_dir: str = "linkedin_profile",
            hits_dir: str = "sniffer_hits",
            regex_mode: bool = False,
    ) -> None:
        super().__init__(target_url=target_url, user_data_dir=user_data_dir)

        self.search_terms = search_terms
        self.regex_mode = regex_mode

        self.hits_dir = Path(hits_dir)
        self.hits_dir.mkdir(exist_ok=True)

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
        """Se for JSON, identado; senão, texto original."""
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

    async def handle_response(self, response) -> None:
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

    def setup_listeners(self) -> None:
        assert self.page is not None
        self.page.on("response", self.handle_response)

    async def start(self) -> None:
        await self.setup_browser()
        self.setup_listeners()

        print("[SNIFFER] Termos alvo:", self.search_terms)
        await self.goto_target()

        print("[INFO] Se pedir login, faça APENAS uma vez. Persistência está ativa.")
        print("[INFO] Sniffer rodando… navegue normalmente.\n")

        try:
            await asyncio.sleep(999999)
        finally:
            await self.close()


class LinkedInConnectionsScraper(LinkedInBase):
    """
    Scraper para coletar TODAS as URLs das conexões na página
    /mynetwork/invite-connect/connections/.
    """

    def __init__(
            self,
            target_url: str = "https://www.linkedin.com/mynetwork/invite-connect/connections/",
            user_data_dir: str = "linkedin_profile",
            output_txt: str = "connections_urls.txt",
            output_json: str = "connections_urls.json",
    ) -> None:
        super().__init__(target_url=target_url, user_data_dir=user_data_dir)
        self.output_txt = Path(output_txt)
        self.output_json = Path(output_json)

    async def auto_scroll(
            self,
            max_loops: int = 50,
            delay_ms: int = 2000,
            stagnation_limit: int = 3,
    ) -> None:
        """
        Faz scroll com wheel (mais parecido com usuário real).
        Para quando o número de anchors /in/ parar de crescer
        por alguns loops seguidos.
        """
        assert self.page is not None

        selector = "a[href*='/in/']"
        stagnant = 0
        last_count = 0

        for i in range(max_loops):
            loc = self.page.locator(selector)
            before = await loc.count()

            print(f"[SCROLL] loop={i} antes={before}")

            # scroll "humano" pra baixo
            await self.page.mouse.wheel(0, 2000)
            await self.page.wait_for_timeout(delay_ms)

            loc = self.page.locator(selector)
            after = await loc.count()

            print(f"[SCROLL] loop={i} depois={after}")

            if after <= before:
                stagnant += 1
                if stagnant >= stagnation_limit:
                    print("[SCROLL] Nenhuma conexão nova em vários loops. Parando.")
                    break
            else:
                stagnant = 0
                last_count = after

        print(f"[SCROLL] Scroll finalizado. Anchors visíveis: {last_count}")

    async def extract_connections(self) -> List[Dict[str, str]]:
        """
        Extrai nome + URL de cada conexão única.
        """
        assert self.page is not None

        loc = self.page.locator("a[href*='/in/']")
        total = await loc.count()
        print(f"[EXTRACT] Encontrados {total} anchors com '/in/' antes de deduplicar.")

        connections: Dict[str, Dict[str, str]] = {}

        for i in range(total):
            a = loc.nth(i)

            href = await a.get_attribute("href")
            if not href:
                continue

            href_clean = href.split("?")[0]

            name = (await a.inner_text() or "").strip()

            if href_clean not in connections:
                connections[href_clean] = {
                    "name": name,
                    "url": href_clean,
                }

        print(f"[EXTRACT] {len(connections)} conexões únicas após deduplicar.")
        return list(connections.values())

    def save_connections(self, conns: List[Dict[str, str]]) -> None:
        """
        Salva em .txt (só URLs) e .json (nome + url).
        """
        with self.output_txt.open("w", encoding="utf-8") as f:
            for c in conns:
                f.write(c["url"] + "\n")

        with self.output_json.open("w", encoding="utf-8") as f:
            json.dump(conns, f, indent=2, ensure_ascii=False)

        print(f"[SAVE] {len(conns)} conexões salvas em:")
        print(f"       - {self.output_txt}")
        print(f"       - {self.output_json}")

    async def run(self) -> None:
        await self.setup_browser()
        await self.goto_target()

        print("[INFO] Se pedir login, faça APENAS uma vez. Persistência está ativa.")
        print("[INFO] Aguardando página de conexões carregar...")

        assert self.page is not None
        await self.page.wait_for_timeout(2000)

        await self.auto_scroll()
        conns = await self.extract_connections()
        self.save_connections(conns)

        await self.close()


if __name__ == "__main__":
    MODE = "connections"

    if MODE == "sniffer":
        search_terms = ["Otimizei drones", "Otimizei", "drones", "otimizei drones"]
        url = "https://www.linkedin.com/in/me/details/experience/"

        sniffer = LinkedInSniffer(
            search_terms=search_terms,
            target_url=url,
            regex_mode=False,
        )
        asyncio.run(sniffer.start())

    elif MODE == "connections":
        scraper = LinkedInConnectionsScraper()
        asyncio.run(scraper.run())

    else:
        raise SystemExit(f"MODE inválido: {MODE}")
