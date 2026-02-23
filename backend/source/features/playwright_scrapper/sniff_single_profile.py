import asyncio
import json
import re
from pathlib import Path
from urllib.parse import urlparse

from playwright.async_api import Error as PlaywrightError
from backend.source.features.playwright_scrapper.linkedin_core import LinkedInBrowserSniffer


# ======================================================
#              A REDE DE ARRASTÃO MÁXIMA
# ======================================================

def extract_everything(raw_text: str) -> list:
    """
    Não importa a chave do JSON ou a tag do HTML.
    Pega todas as strings existentes no payload.
    """
    if not raw_text:
        return []

    # 1. Pega tudo que está entre aspas duplas (lidando com aspas escapadas \")
    json_strings = re.findall(r'"((?:[^"\\]|\\.)*)"', raw_text)

    # 2. Pega tudo que estiver no meio de tags HTML (ex: >Mônica Busatta<)
    html_strings = re.findall(r'>([^<]+)<', raw_text)

    todos_os_textos = json_strings + html_strings

    pepita = []
    for m in todos_os_textos:
        try:
            # Transforma de volta em string real (resolve \n, \u00e1, etc)
            s = json.loads(f'"{m}"')
        except:
            s = m

        s = s.strip()

        # --- FILTROS MÍNIMOS (Só para matar código de máquina) ---
        if len(s) < 3: continue

        # Ignora IDs internos do LinkedIn e lixo estrutural
        if s.startswith("urn:li:"): continue
        if s.startswith("com.linkedin."): continue
        if s.startswith("ajax:"): continue
        if s.startswith("http"): continue  # Ignora URLs

        # Ignora strings enormes sem nenhum espaço (geralmente são Hashes, Tokens ou Base64)
        if " " not in s and len(s) > 30: continue

        # Ignora nomes de classes CSS (geralmente começam com _, tracos ou camelCase estranho)
        if re.match(r'^_[a-zA-Z0-9_-]+$', s): continue
        if s in ["div", "span", "section", "button", "path", "svg", "className", "children"]: continue

        pepita.append(s)

    # Remove duplicatas exatas mantendo a ordem
    return list(dict.fromkeys(pepita))


def is_interesting_url(url: str) -> bool:
    """Apenas barra requisições pesadas que não têm texto."""
    parsed = urlparse(url)
    asset_exts = (".js", ".css", ".png", ".jpg", ".jpeg", ".svg", ".gif", ".webp", ".woff", ".woff2", ".ttf")
    if parsed.path.endswith(asset_exts):
        return False
    if "static.licdn.com" in url or "ads" in url or "tracking" in url:
        return False
    return True


# ======================================================
#              SCRAPER (MODO MANUAL DO USUÁRIO)
# ======================================================

class RawNuggetExtractor(LinkedInBrowserSniffer):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.sopa_de_letrinhas = []
        self.captured_curls = 0

    async def start(self):
        await self.setup_browser()
        self.page.on("response", self.handle_response)

        print(f"\n[INFO] Acessando o perfil: {self.target_url}")
        await self.goto_target()

        print("\n" + "=" * 50)
        print("🟢 MODO DE CAPTURA LIVRE ATIVADO 🟢")
        print("O script está escutando TUDO. Navegue no navegador:")
        print(" 1. Role a página devagar até o final.")
        print(" 2. Clique em todos os botões 'Ver mais' (See more).")
        print(" 3. Abra as seções de Experiência/Educação se quiser garantir.")
        print("Quando terminar de extrair o ouro, pressione CTRL+C no terminal.")
        print("=" * 50 + "\n")

        # Fica rodando infinitamente até você derrubar com CTRL+C
        await asyncio.sleep(999999)

    async def handle_response(self, response):
        """Captura absolutamente tudo que passa pela rede."""
        url = response.url

        if response.status != 200 or not is_interesting_url(url):
            return

        try:
            raw_text = await response.text()
            extracted_strings = extract_everything(raw_text)

            if extracted_strings:
                self.captured_curls += 1
                self.sopa_de_letrinhas.extend(extracted_strings)
                print(f"[CAPTURA] {len(extracted_strings):04d} fragmentos <- {url.split('?')[0][-50:]}")

        except Exception:
            pass  # Falhas normais de rede/CORS

    def save_nugget(self) -> None:
        """Salva a massa de dados quando o usuário interrompe o script."""
        pepita_final = list(dict.fromkeys(self.sopa_de_letrinhas))

        output_file = Path("pepita_bruta.json")
        output_file.write_text(
            json.dumps(pepita_final, indent=2, ensure_ascii=False),
            encoding="utf-8",
        )

        print(f"\n✨ SUCESSO! Capturamos a pepita máxima.")
        print(f"💰 {len(pepita_final)} fragmentos de texto salvos de {self.captured_curls} requisições.")
        print(f"📁 Salvo em: {output_file}\n")


# ======================================================
#                       RUNNER
# ======================================================

async def run_scraper_instance(scraper: RawNuggetExtractor) -> None:
    try:
        await scraper.start()
    except (asyncio.CancelledError, KeyboardInterrupt):
        print("\n[INFO] Finalizando captura...")
        scraper.save_nugget()
    finally:
        try:
            await scraper.close()
        except PlaywrightError:
            pass


if __name__ == "__main__":
    TEST_URL = "https://www.linkedin.com/in/monicasbusatta/"
    bot = RawNuggetExtractor(target_url=TEST_URL)

    try:
        asyncio.run(run_scraper_instance(bot))
    except KeyboardInterrupt:
        pass
