import asyncio
import json
import re
from pathlib import Path
from urllib.parse import urlparse

from playwright.async_api import Error as PlaywrightError
from backend.source.features.playwright_scrapper.linkedin_core import LinkedInBrowserSniffer


# ======================================================
#              EXTRATOR COM FILTRO SEGURO
# ======================================================

def extract_everything(raw_text: str) -> list:
    if not raw_text:
        return []

    json_strings = re.findall(r'"((?:[^"\\]|\\.)*)"', raw_text)
    html_strings = re.findall(r'>([^<]+)<', raw_text)
    todos_os_textos = json_strings + html_strings

    # Lixo seguro de remover (Botões e UI que não tem ouro nenhum)
    lixo_de_ui = {
        "see more", "show less", "show all", "show credential", "follow", "unfollow",
        "connect", "message", "save", "share", "like", "comment", "repost",
        "send", "pending", "withdraw", "join", "leave", "subscribe",
        "unsubscribe", "view profile", "view jobs", "about this profile",
        "more options", "open to", "add profile section", "more", "next", "previous",
        "activity", "experience", "education", "licenses & certifications", "skills", "interests"
    }

    pepita = []
    for m in todos_os_textos:
        try:
            s = json.loads(f'"{m}"')
        except:
            s = m

        s = s.strip()
        s_lower = s.lower()

        # Filtros estruturais (mata código)
        if len(s) < 3: continue
        if s.startswith("urn:li:"): continue
        if s.startswith("com.linkedin."): continue
        if s.startswith("ajax:"): continue
        if s.startswith("http"): continue
        if " " not in s and len(s) > 30: continue
        if re.match(r'^_[a-zA-Z0-9_-]+$', s): continue
        if s in ["div", "span", "section", "button", "path", "svg", "className", "children"]: continue

        # Filtros de UI
        if s_lower in lixo_de_ui: continue
        if re.match(r'^\+?\d+[\d,\.]*\+?\s*(followers|connections|members|following)$', s_lower): continue
        if s_lower.startswith("sorry, unable to") or "please try again" in s_lower: continue
        if "won’t be notified" in s_lower or s_lower.startswith("invitation not sent"): continue

        pepita.append(s)

    return list(dict.fromkeys(pepita))


def is_interesting_url(url: str) -> bool:
    parsed = urlparse(url)
    asset_exts = (".js", ".css", ".png", ".jpg", ".jpeg", ".svg", ".gif", ".webp", ".woff", ".woff2", ".ttf")
    if parsed.path.endswith(asset_exts) or any(x in url for x in ["static.licdn.com", "ads", "tracking"]):
        return False
    return True


# ======================================================
#              SCRAPER (PILOTO AUTOMÁTICO + AUDITORIA)
# ======================================================

class AutoNuggetExtractor(LinkedInBrowserSniffer):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.sopa_de_letrinhas = []
        self.captured_curls = 0

    async def start(self):
        await self.setup_browser()
        self.page.on("response", self.handle_response)

        print(f"\n[INFO] Acessando o perfil: {self.target_url}")
        await self.goto_target()

        print("\n🤖 PILOTO AUTOMÁTICO ATIVADO 🤖")
        print("Solte o mouse! O robô vai descer a página e clicar em todos")
        print("os botões de 'Ver Mais' sozinho para garantir 100% dos dados.\n")

        await self.auto_scroll_and_click()

        print("[INFO] Rolagem concluída. Aguardando últimos dados de rede...")
        await asyncio.sleep(4)
        self.save_nugget()

    async def auto_scroll_and_click(self):
        """Injeta um Javascript que desce a tela e clica em todos os 'See more'."""
        await self.page.evaluate("""
                                 async () => {
                                     const delay = ms => new Promise(res => setTimeout(res, ms));
                                     let scrolls = 0;

                                     while (scrolls < 15) { // Evita loop infinito em perfis bugados
                                         window.scrollBy(0, 500);
                                         await delay(600); // Tempo para a rede respirar

                                         // Busca todos os botões na tela
                                         const buttons = Array.from(document.querySelectorAll('button'));
                                         for (const btn of buttons) {
                                             const text = btn.innerText.toLowerCase();
                                             // Se for botão de expandir texto, clica nele!
                                             if (text.includes('see more') || text.includes('ver mais') || text.includes('show all') || text.includes('exibir mais')) {
                                                 try {
                                                     btn.click();
                                                     await delay(300); // Espera o texto carregar
                                                 } catch (e) {
                                                 }
                                             }
                                         }

                                         // Verifica se chegou ao fim da página
                                         if ((window.innerHeight + window.scrollY) >= document.body.offsetHeight - 100) {
                                             break;
                                         }
                                         scrolls++;
                                     }
                                 }
                                 """)

    async def handle_response(self, response):
        url = response.url
        if response.status != 200 or not is_interesting_url(url): return

        try:
            raw_text = await response.text()
            extracted = extract_everything(raw_text)

            if extracted:
                self.captured_curls += 1
                self.sopa_de_letrinhas.extend(extracted)
                print(f"[CAPTURA] {len(extracted):03d} fragmentos <- {url.split('?')[0][-40:]}")
        except:
            pass

    def verify_nugget(self, pepita: list):
        """Audita se a pepita contém as informações chaves que esperamos."""
        sopa_completa = " ".join(pepita).lower()

        ouro_esperado = {
            "Nome Completo": "Mônica Busatta",
            "Headline": "Front-end Software Engineer | Full Stack",
            "About (Resumo)": "I’m a Front-end Software Engineer with 7+ years of experience",
            "Exp Dexian (Descrição)": "I’m a Front-end Engineer for Itti, a client based in Paraguay",
            "Exp Freelance (Descrição)": "I’ve been collaborating with a Colombian design agency",
            "Exp Tiba (Descrição)": "Responsible for the front-end development of a SaaS platform",
            "Exp AZZ (Descrição)": "Developed business websites ranging from corporate showcase sites",
            "Formação (Detalhe)": "Graduação em Sistemas para Internet com abrangimento em Banco de Dados",
            "Skill Específica": "TypeScript"
        }

        print("=== AUDITORIA DA PEPITA BRUTA ===")
        sucessos = 0
        for chave, trecho in ouro_esperado.items():
            if trecho.lower() in sopa_completa:
                print(f"✅ ENCONTRADO: {chave}")
                sucessos += 1
            else:
                print(f"❌ FALTANDO:  {chave}")

        print(f"\nTotal: {sucessos}/{len(ouro_esperado)} itens vitais capturados.\n")

    def save_nugget(self) -> None:
        pepita_final = list(dict.fromkeys(self.sopa_de_letrinhas))
        output_file = Path("pepita_bruta.json")
        output_file.write_text(json.dumps(pepita_final, indent=2, ensure_ascii=False), encoding="utf-8")

        print(f"\n✨ SUCESSO! Captura finalizada com segurança.")
        print(f"💰 {len(pepita_final)} fragmentos de texto limpo salvos.")
        print(f"📁 Salvo em: {output_file}\n")

        # Chama a verificação logo após gerar a lista final!
        self.verify_nugget(pepita_final)


async def run_scraper_instance(scraper: AutoNuggetExtractor) -> None:
    try:
        await scraper.start()
    except (asyncio.CancelledError, KeyboardInterrupt):
        print("\n[INFO] Cancelado.")
    finally:
        try:
            # Garante que o Chromium feche direito sem dar crash no terminal
            await scraper.close()
        except:
            pass


if __name__ == "__main__":
    TEST_URL = "https://www.linkedin.com/in/monicasbusatta/"
    bot = AutoNuggetExtractor(target_url=TEST_URL)
    asyncio.run(run_scraper_instance(bot))
