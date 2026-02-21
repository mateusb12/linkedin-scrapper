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


class LinkedInConnectionsAPIScraper(LinkedInBase):
    """
    Coleta TODAS as conexões do LinkedIn usando a API que alimenta
    a página /mynetwork/invite-connect/connections/ (lazy loading).

    Ideia:
      - Hook em responses que tenham "connectionsList" ou "relationships/connections"
      - Decodificar body (utf-8/gzip/deflate)
      - Extrair publicIdentifier / URLs
      - Montar https://www.linkedin.com/in/<slug>/
      - Salvar em .txt e .json
    """

    def __init__(
            self,
            target_url: str = "https://www.linkedin.com/mynetwork/invite-connect/connections/",
            user_data_dir: str = "linkedin_profile",
            output_txt: str = "connections_urls_api.txt",
            output_json: str = "connections_urls_api.json",
    ) -> None:
        super().__init__(target_url=target_url, user_data_dir=user_data_dir)

        self.output_txt = Path(output_txt)
        self.output_json = Path(output_json)

        # slug -> data
        self._profiles: dict[str, dict] = {}

    # ---------- helpers para reusar a lógica de decode do sniffer ----------

    @staticmethod
    def try_decode(body: bytes) -> str:
        try:
            return body.decode("utf-8")
        except Exception:
            pass

        try:
            import zlib
            return zlib.decompress(body, zlib.MAX_WBITS | 16).decode("utf-8")
        except Exception:
            pass

        try:
            import zlib
            return zlib.decompress(body).decode("utf-8")
        except Exception:
            pass

        try:
            return body.hex()
        except Exception:
            return ""

    @staticmethod
    def safe_json_loads(text: str):
        try:
            return json.loads(text)
        except Exception:
            return None

    @staticmethod
    def _extract_public_identifiers_from_json(obj) -> list[dict]:
        """
        Procura recursivamente por estruturas que tenham publicIdentifier/occupation/nome.
        Retorna uma lista de mini perfis:
          { slug, name, headline }
        """
        found: list[dict] = []

        def walk(node):
            if isinstance(node, dict):
                # caso clássico: miniProfile
                if "publicIdentifier" in node:
                    slug = node.get("publicIdentifier")
                    first = (node.get("firstName") or "").strip()
                    last = (node.get("lastName") or "").strip()
                    name = f"{first} {last}".strip() or None
                    headline = node.get("occupation") or node.get("headline")
                    found.append(
                        {
                            "slug": slug,
                            "name": name,
                            "headline": headline,
                        }
                    )

                # continua descendo
                for v in node.values():
                    walk(v)

            elif isinstance(node, list):
                for item in node:
                    walk(item)

        walk(obj)
        return found

    @staticmethod
    def _extract_slugs_from_text(text: str) -> list[str]:
        """
        Fallback bem sujo: regex em texto/hex procurando por publicIdentifier.
        Não é perfeito, mas às vezes resolve quando o JSON não é limpo.
        """
        slugs: set[str] = set()

        # "publicIdentifier":"lucaspinheiro00"
        for m in re.finditer(r'"publicIdentifier"\s*:\s*"([^"]+)"', text):
            slugs.add(m.group(1))

        # ...linkedin.com/in/slug...
        for m in re.finditer(r"linkedin\.com/in/([A-Za-z0-9\-_%]+)", text):
            slugs.add(m.group(1))

        return list(slugs)

    # ---------- handler de responses da API ----------

    async def handle_response(self, response) -> None:
        url = response.url

        # só interessa connectionsList / relationships/connections
        if (
                "sdui.pagers.mynetwork.connectionsList" not in url
                and "voyager/api/relationships/connections" not in url
        ):
            return

        print(f"[API] Hit em conexões: {url}")

        try:
            body = await response.body()
        except Exception:
            print("[API] Falha ao ler body")
            return

        decoded = self.try_decode(body)
        if not decoded:
            print("[API] Body vazio/ilegível")
            return

        # 1) tenta como JSON mesmo
        data = self.safe_json_loads(decoded)
        mini_profiles: list[dict] = []

        if data is not None:
            mini_profiles = self._extract_public_identifiers_from_json(data)
        else:
            # 2) fallback: regex no texto bruto
            slugs = self._extract_slugs_from_text(decoded)
            mini_profiles = [{"slug": s, "name": None, "headline": None} for s in slugs]

        if not mini_profiles:
            print("[API] Nenhum publicIdentifier encontrado nessa resposta.")
            return

        # acumular no dicionário
        before = len(self._profiles)
        for mp in mini_profiles:
            slug = mp.get("slug")
            if not slug:
                continue

            url_profile = f"https://www.linkedin.com/in/{slug}/"

            if slug not in self._profiles:
                self._profiles[slug] = {
                    "slug": slug,
                    "url": url_profile,
                    "name": mp.get("name"),
                    "headline": mp.get("headline"),
                }

        after = len(self._profiles)
        print(f"[API] Perfis acumulados: {after} (antes={before}, novos={after - before})")

    # ---------- auto-scroll para forçar lazy loading / paginação ----------

    async def _auto_scroll_js(self, loops: int = 60, delay_ms: int = 800) -> None:
        """
        Scroll na página inteira, igual você faria no console:

        for (let i = 0; i < loops; i++) {
          window.scrollTo(0, document.body.scrollHeight);
          await new Promise(r => setTimeout(r, delayMs));
        }

        Aqui fazemos o loop no Python e só chamamos evaluate com uma string.
        """
        assert self.page is not None

        print(f"[JS] Scroll automático: loops={loops}, delay={delay_ms}ms")

        for i in range(loops):
            await self.page.evaluate("window.scrollTo(0, document.body.scrollHeight);")
            await self.page.wait_for_timeout(delay_ms)
            print(f"[JS] scroll loop={i}")

    # ---------- salvar resultado ----------

    def save_connections(self) -> None:
        profiles = list(self._profiles.values())
        profiles.sort(key=lambda p: (p["name"] or "", p["slug"]))

        # .txt → só URLs
        with self.output_txt.open("w", encoding="utf-8") as f:
            for p in profiles:
                f.write(p["url"] + "\n")

        # .json → slug + name + headline + url
        with self.output_json.open("w", encoding="utf-8") as f:
            json.dump(profiles, f, indent=2, ensure_ascii=False)

        print(f"[SAVE] {len(profiles)} conexões salvas em:")
        print(f"       - {self.output_txt}")
        print(f"       - {self.output_json}")

    # ---------- fluxo principal ----------

    async def run(self) -> None:
        await self.setup_browser()
        assert self.page is not None

        # hook nas responses da API
        self.page.on("response", self.handle_response)

        await self.goto_target()
        print("[INFO] Se pedir login, faça APENAS uma vez. Persistência está ativa.")
        print("[INFO] Aguardando render inicial...")
        await self.page.wait_for_timeout(2000)

        try:
            # força lazy-loading / paginação
            await self._auto_scroll_js(loops=80, delay_ms=800)

            # espera últimas requisições chegarem
            await self.page.wait_for_timeout(3000)

        finally:
            # >>> MESMO SE DER CTRL+C, VAI PARAR AQUI <<<
            print(f"[INFO] Finalizando. Perfis acumulados: {len(self._profiles)}")
            self.save_connections()

            try:
                await self.close()
            except Exception as e:
                print(f"[WARN] Erro ao fechar contexto: {e}")


if __name__ == "__main__":
    MODE = "connections"

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
        scraper = LinkedInConnectionsAPIScraper()
        asyncio.run(scraper.run())

    else:
        raise SystemExit(f"MODE inválido: {MODE}")
