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

    Estratégia primária:
      - decodificar body (utf-8, gzip, deflate, hex)
      - procurar search_terms em BODY + URL
      - salvar payload quando encontrar (hit_*.txt)

    Estratégia secundária (fallback de investigação):
      - manter um "pool" de requests observados (seen_urls)
      - logar cada nova request como:
          [POOL] #0007 GET https://...
      - salvar esse log em requests_pool.log
      - você clica em "Show more", scroll, etc
      - vê quais #ids novos surgiram depois da interação.
    """

    def __init__(
            self,
            search_terms: List[str],
            target_url: str,
            user_data_dir: str = "linkedin_profile",
            hits_dir: str = "sniffer_hits",
            regex_mode: bool = False,
            *,
            only_interesting: bool = True,
            enable_pool: bool = True,
    ) -> None:
        super().__init__(target_url=target_url, user_data_dir=user_data_dir)

        self.search_terms = search_terms
        self.regex_mode = regex_mode

        self.hits_dir = Path(hits_dir)
        self.hits_dir.mkdir(exist_ok=True)

        # Pool de requests (fallback / modo investigativo)
        self.enable_pool = enable_pool
        self.seen_urls: set[str] = set()
        self.request_index: int = 0
        self.pool_log = Path("requests_pool.log")
        self.pool_log.write_text("", encoding="utf-8")  # limpa a cada run

        # Filtro rápido de "endpoints interessantes"
        self.only_interesting = only_interesting
        self.interesting_fragments = [
            "voyager",
            "graphql",
            "sdui",
            "relationships",
            "connections",
        ]

    # ------------- helpers de decodificação -------------

    @staticmethod
    def try_decode(body: bytes) -> str:
        """Decodifica JSON, SDUI ou stream em múltiplos formatos."""
        # 1) utf-8 normal
        try:
            return body.decode("utf-8")
        except Exception:
            pass

        # 2) gzip
        try:
            return zlib.decompress(body, zlib.MAX_WBITS | 16).decode("utf-8")
        except Exception:
            pass

        # 3) deflate
        try:
            return zlib.decompress(body).decode("utf-8")
        except Exception:
            pass

        # 4) fallback → hex (protobuf, binário)
        try:
            return body.hex()
        except Exception:
            return ""

    @staticmethod
    def pretty_format(text: str) -> str:
        """Se for JSON, indenta; senão, devolve o texto como veio."""
        try:
            parsed = json.loads(text)
            return json.dumps(parsed, indent=2, ensure_ascii=False)
        except Exception:
            return text

    def matches(self, text: str) -> bool:
        """Verifica se algum termo alvo aparece na string."""
        if not self.search_terms:
            return False

        for term in self.search_terms:
            if self.regex_mode:
                if re.search(term, text, re.IGNORECASE):
                    return True
            else:
                if term.lower() in text.lower():
                    return True
        return False

    # ------------- callback de resposta -------------

    async def handle_response(self, response) -> None:
        url = response.url

        # Filtrar só tipos de recursos relevantes (xhr/fetch/document)
        resource_type = response.request.resource_type
        if resource_type not in ("xhr", "fetch", "document"):
            return

        # Filtro de endpoints "interessantes" (pode desligar com only_interesting=False)
        if self.only_interesting:
            if not any(frag in url for frag in self.interesting_fragments):
                return

        # ===========================
        # 1) POOL DE REQUESTS (fallback)
        # ===========================
        if self.enable_pool:
            is_new = url not in self.seen_urls
            if is_new:
                self.seen_urls.add(url)
                self.request_index += 1

                line = f"[POOL] #{self.request_index:04d} {response.request.method} {url}\n"
                print(line.strip())

                with self.pool_log.open("a", encoding="utf-8") as f:
                    f.write(line)

        # ===========================
        # 2) LE BODY PARA MATCH
        # ===========================
        try:
            body = await response.body()
        except Exception:
            body = b""

        decoded = self.try_decode(body) or ""

        # buscamos no BODY + na própria URL
        haystack = decoded + "\n\n" + url

        if not self.matches(haystack):
            return

        # ===========================
        # 3) HIT ENCONTRADO
        # ===========================
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
            f.write("=== URL ===\n")
            f.write(url + "\n\n")

            f.write("=== REQUEST HEADERS ===\n")
            for k, v in response.request.headers.items():
                f.write(f"{k}: {v}\n")

            f.write("\n=== RESPONSE HEADERS ===\n")
            for k, v in response.headers.items():
                f.write(f"{k}: {v}\n")

            f.write("\n=== BODY ===\n\n")
            f.write(self.pretty_format(decoded))

        print(f"[SALVO] {filename}\n")

    # ------------- wiring -------------

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
            # fecha sem deixar exceção de contexto vazar
            try:
                await self.close()
            except Exception as e:
                print(f"[WARN] Erro ao fechar contexto: {e}")


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

    async def auto_scroll(self, max_loops: int = 50, delay_ms: int = 2000) -> set[str]:
        """
        Faz scroll na página inteira + tenta clicar em "Show more" / "Show more results".
        Acumula URLs únicas de conexões enquanto rola e pagina.
        Para quando não entra URL nova por alguns loops seguidos.
        """
        assert self.page is not None

        seen_urls: set[str] = set()
        stagnant_loops = 0
        STAGNATION_LIMIT = 3

        for i in range(max_loops):
            # 1) scroll "página inteira"
            await self.page.evaluate("window.scrollTo(0, document.body.scrollHeight);")
            await self.page.wait_for_timeout(delay_ms)

            # 2) tentar clicar em "Show more results" / "Show more"
            clicked = False
            for label in ["Show more results", "Show more", "See more"]:
                btn = self.page.get_by_role("button", name=label)
                if await btn.count() > 0:
                    try:
                        print(f"[SCROLL] loop={i} clicando botão: {label!r}")
                        await btn.first.click()
                        clicked = True
                        await self.page.wait_for_timeout(delay_ms)
                        break
                    except Exception as e:
                        print(f"[SCROLL] Erro ao clicar em {label!r}: {e}")

            # 3) coletar anchors /in/ e medir crescimento
            loc = self.page.locator("a[href*='/in/']")
            count = await loc.count()
            urls_this_loop: set[str] = set()

            for idx in range(count):
                a = loc.nth(idx)
                href = await a.get_attribute("href")
                if not href:
                    continue
                href_clean = href.split("?")[0]
                urls_this_loop.add(href_clean)

            before = len(seen_urls)
            seen_urls |= urls_this_loop
            after = len(seen_urls)

            print(
                f"[SCROLL] loop={i} anchors_dom={count} "
                f"unique_before={before} unique_after={after}"
            )

            if after == before and not clicked:
                stagnant_loops += 1
                if stagnant_loops >= STAGNATION_LIMIT:
                    print("[SCROLL] Nenhuma URL nova em vários loops. Parando.")
                    break
            else:
                stagnant_loops = 0

        print(f"[SCROLL] Scroll finalizado. URLs únicas coletadas: {len(seen_urls)}")
        return seen_urls

    async def extract_connections_from_urls(self, urls: set[str]) -> List[Dict[str, str]]:
        """
        A partir das URLs únicas, tenta extrair um nome razoável do DOM.
        (Nem sempre vai ter o nome perfeito para todas, mas resolve bem).
        """
        assert self.page is not None

        connections: List[Dict[str, str]] = []

        for url in sorted(urls):
            # tenta achar um anchor correspondente no DOM atual
            loc = self.page.locator(f"a[href*='{url}']")
            name = None
            if await loc.count() > 0:
                text = (await loc.first.inner_text() or "").strip()
                name = text or None

            connections.append(
                {
                    "name": name,
                    "url": url,
                }
            )

        print(f"[EXTRACT] Montadas {len(connections)} conexões a partir das URLs únicas.")
        return connections

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

        urls = await self.auto_scroll()
        conns = await self.extract_connections_from_urls(urls)
        self.save_connections(conns)

        await self.close()


if __name__ == "__main__":
    MODE = "sniffer"

    if MODE == "sniffer":
        search_terms = ["lucaspinheiro00"]
        url = "https://www.linkedin.com/mynetwork/invite-connect/connections/"

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
