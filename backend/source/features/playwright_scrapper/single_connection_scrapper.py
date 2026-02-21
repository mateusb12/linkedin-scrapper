import asyncio
import re
import zlib
from pathlib import Path
from playwright.async_api import async_playwright, Page, BrowserContext


class LinkedInBase:
    def __init__(self, target_url: str, user_data_dir: str = "linkedin_profile"):
        self.target_url = target_url
        self.user_data_dir = Path(user_data_dir)
        self.user_data_dir.mkdir(exist_ok=True)
        self.playwright = None
        self.context: BrowserContext | None = None
        self.page: Page | None = None

    async def setup_browser(self):
        self.playwright = await async_playwright().start()
        self.context = await self.playwright.chromium.launch_persistent_context(
            user_data_dir=str(self.user_data_dir),
            headless=False,
            args=["--disable-web-security"],
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36"
        )
        self.page = self.context.pages[0] if self.context.pages else await self.context.new_page()

    async def goto_target(self):
        print(f"[PAGE] Acessando: {self.target_url}")
        await self.page.goto(self.target_url)

    async def close(self):
        try:
            if self.context: await self.context.close()
            if self.playwright: await self.playwright.stop()
        except Exception:
            pass


class LinkedInGoldAccumulator(LinkedInBase):
    def __init__(self, target_url: str, user_data_dir: str = "linkedin_profile"):
        super().__init__(target_url, user_data_dir)
        # Em vez de guardar bytes complexos, nós guardamos o TEXTO cru das respostas importantes
        self.pool_texts = []
        self._processed = False

    @staticmethod
    def try_decode(body: bytes) -> str:
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
        url = response.url

        # Filtro Absoluto: Só queremos as requisições que sabemos conter o ouro.
        is_above = "profileCardsAboveActivity" in url
        is_below = "profileCardsBelowActivityPart" in url
        is_document = response.request.resource_type == "document" and "linkedin.com/in/" in url

        if not (is_above or is_below or is_document):
            return

        try:
            body_bytes = await response.body()
            decoded = self.try_decode(body_bytes)
            if decoded:
                self.pool_texts.append(decoded)
        except Exception:
            pass

    def mine_pool(self):
        """Ocorre apenas quando o script é interrompido (Stop/Ctrl+C)"""
        if self._processed: return
        self._processed = True

        print(f"\n\n[GARIMPO] Analisando a Pool capturada ({len(self.pool_texts)} respostas)...")

        if not self.pool_texts:
            print("[VAZIO] Nenhuma requisição importante foi capturada. Você rolou a página?")
            return

        textos_encontrados = []

        # Usando Expressões Regulares poderosas para extrair APENAS os textos úteis
        # das respostas brutas, ignorando o lixo do RSC ou JSON estrutural
        for text in self.pool_texts:
            import html
            # 1. Resolve entidades HTML se for o documento raiz
            texto_limpo = html.unescape(text)

            # 2. A Mágica: Procura estritamente por coisas como "text":["Front-end Software Engineer"]
            # ou "children":["Dexian Brasil"] ou simplesmente valores isolados limpos
            padroes = [
                r'"text"\s*:\s*\[\s*"([^"]+)"\s*\]',  # Padrão RSC: "text":["Cargo"]
                r'"children"\s*:\s*\[\s*"([^"]+)"\s*\]',  # Padrão RSC: "children":["Empresa"]
                r'"summary"\s*:\s*"([^"]+)"',  # Padrão JSON/Voyager: "summary":"About"
                r'"headline"\s*:\s*"([^"]+)"',  # Padrão JSON/Voyager: "headline":"Dev"
            ]

            for padrao in padroes:
                matches = re.findall(padrao, texto_limpo)
                textos_encontrados.extend(matches)

        # Filtra sujeiras residuais que sobraram
        lixos = ["Show more", "Ver mais", "Show credential", "logo", "Voltar", "Avançar", "•"]
        resultado_limpo = []

        for t in textos_encontrados:
            t_clean = t.strip()

            # Limpa quebras de linha encavaladas e lixos curtos
            t_clean = t_clean.replace('\\n', '\n')
            if len(t_clean) < 2 or t_clean in lixos:
                continue

            # Evita colocar a mesma linha duas vezes seguidas no array final
            if not resultado_limpo or resultado_limpo[-1] != t_clean:
                resultado_limpo.append(t_clean)

        print("\n" + "=" * 80)
        print("          ✨ DADOS MINERADOS DIRETAMENTE DA TELA ✨          ")
        print("=" * 80)

        if not resultado_limpo:
            print("⚠️ Nenhum texto pôde ser extraído da Pool. Tente rolar a página novamente.")
        else:
            for linha in resultado_limpo:
                # Adiciona um destaque apenas nas descrições grandes (About ou Descrições de Cargo)
                if len(linha) > 80:
                    print(f"\n \"{linha}\"\n")
                else:
                    print(f" -> {linha}")

        print("=" * 80 + "\n")

    def setup_listeners(self):
        assert self.page is not None
        self.page.on("response", self.handle_response)

    async def start(self):
        await self.setup_browser()
        self.setup_listeners()
        await self.goto_target()

        print("\n[INFO] 🕵️‍♂️ Sniffer Ativado. Escutando apenas chamadas vitais.")
        print("[INFO] Role a página lentamente até o final das experiências.")
        print("[INFO] Aperte o Botão Stop (Quadrado Vermelho) no PyCharm para ver a Ficha.\n")

        try:
            await asyncio.sleep(999999)
        except asyncio.CancelledError:
            pass


if __name__ == "__main__":
    import atexit
    import sys

    url = "https://www.linkedin.com/in/monicasbusatta/"

    digger = LinkedInGoldAccumulator(target_url=url)

    atexit.register(digger.mine_pool)

    try:
        asyncio.run(digger.start())
    except BaseException:
        sys.exit(0)
