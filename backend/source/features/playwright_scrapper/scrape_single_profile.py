import asyncio
import re
import html
import json
import zlib
from pathlib import Path
from playwright.async_api import async_playwright, Page, BrowserContext


def estruturar_dados_perfil(lista_bruta: list) -> dict:
    perfil_estruturado = {}
    secao_atual = "Resumo"  # O topo do perfil (Nome, Headline, etc) vai cair aqui

    # Palavras-chave que indicam mudança de seção no LinkedIn
    secoes_linkedin = {
        "Experience": "Experiencia",
        "Education": "Educacao",
        "Skills": "Habilidades",
        "About": "Sobre",
        "Licenses & certifications": "Certificacoes",
        "Projects": "Projetos",
        "Languages": "Idiomas",
        "Interests": "Interesses",
        "Recommendations": "Recomendacoes"
    }

    # Lixos da interface que não agregam valor
    ignorar_exatos = {
        "Show all", "Follow", "Following", "Subscribe", "Subscribed",
        "Join", "Joined", "Requested", "Cancel", "Unfollow", "Message",
        "Highlights", "Endorse", "Nothing to see for now", "Show more", "Ver mais"
    }

    for item in lista_bruta:
        item = item.strip()

        # Ignora tokens do backend ($L11, $Ld, etc) e lixos conhecidos
        if item.startswith("$L") or item in ignorar_exatos:
            continue

        # Ignora textos de erro de requisição do front-end
        if "Sorry, unable to" in item or "Unable to" in item:
            continue

        # Se for um título de seção, muda o contexto atual e continua
        if item in secoes_linkedin:
            secao_atual = secoes_linkedin[item]
            perfil_estruturado.setdefault(secao_atual, [])
            continue

        # Adiciona o texto na seção correspondente
        perfil_estruturado.setdefault(secao_atual, []).append(item)

    return perfil_estruturado


class LinkedInBrowserSniffer:
    """Classe Base: Gerencia o Playwright e decodificação do sniffer."""

    def __init__(self, target_url: str, user_data_dir: str = "linkedin_profile") -> None:
        self.target_url = target_url
        self.user_data_dir = Path(user_data_dir)
        self.user_data_dir.mkdir(exist_ok=True)

        self.playwright = None
        self.context: BrowserContext | None = None
        self.page: Page | None = None
        self.pool_texts = []
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
        raise NotImplementedError()

    def setup_listeners(self):
        assert self.page is not None
        self.page.on("response", self.handle_response)

    def extract_data(self):
        raise NotImplementedError()


class ProfileScraper(LinkedInBrowserSniffer):
    """Extrator de Perfil Único (Salva em JSON)."""

    async def handle_response(self, response):
        url = response.url
        if not ("profileCardsAboveActivity" in url or "profileCardsBelowActivityPart" in url or (
                response.request.resource_type == "document" and "linkedin.com/in/" in url)):
            return
        try:
            body_bytes = await response.body()
            decoded = self.try_decode(body_bytes)
            if decoded: self.pool_texts.append(decoded)
        except Exception:
            pass

    def extract_data(self):
        if self._processed: return
        self._processed = True

        print(f"\n[GARIMPO] Analisando a Pool capturada ({len(self.pool_texts)} respostas)...")

        if not self.pool_texts:
            print("[VAZIO] Nenhuma requisição importante foi capturada.")
            return

        textos_encontrados = []
        for text in self.pool_texts:
            texto_limpo = html.unescape(text)
            padroes = [
                r'"text"\s*:\s*\[\s*"([^"]+)"\s*\]',
                r'"children"\s*:\s*\[\s*"([^"]+)"\s*\]',
                r'"summary"\s*:\s*"([^"]+)"',
                r'"headline"\s*:\s*"([^"]+)"',
            ]
            for padrao in padroes:
                textos_encontrados.extend(re.findall(padrao, texto_limpo))

        lixos = ["Show more", "Ver mais", "Show credential", "logo", "Voltar", "Avançar", "•"]
        resultado_limpo = []
        for t in textos_encontrados:
            t_clean = t.strip().replace('\\n', '\n')
            if len(t_clean) < 2 or t_clean in lixos: continue
            if not resultado_limpo or resultado_limpo[-1] != t_clean:
                resultado_limpo.append(t_clean)

        if not resultado_limpo:
            print("⚠️ Nenhum texto extraído.")
            return

        dados_limpos_e_agrupados = estruturar_dados_perfil(resultado_limpo)
        dados_perfil = {"url": self.target_url, "dados_extraidos": dados_limpos_e_agrupados}
        output_file = Path("perfis_minerados.json")
        dados_existentes = []

        if output_file.exists():
            try:
                with output_file.open("r", encoding="utf-8") as f:
                    dados_existentes = json.load(f)
            except json.JSONDecodeError:
                pass

        dados_existentes.append(dados_perfil)
        with output_file.open("w", encoding="utf-8") as f:
            json.dump(dados_existentes, f, ensure_ascii=False, indent=4)

        print(f"✨ Sucesso! Dados salvos em {output_file.name}")

    async def start(self):
        await self.setup_browser()
        self.setup_listeners()
        await self.goto_target()
        print("\n[INFO] 🕵️‍♂️ Sniffer Ativado. Role a página e aperte Stop (ou CTRL+C) para extrair.\n")
        await asyncio.sleep(999999)


from playwright.async_api import Error as PlaywrightError


async def run_scraper_instance(scraper):
    """Garante o encerramento seguro e o trigger da extração."""
    try:
        await scraper.start()
    except (asyncio.CancelledError, KeyboardInterrupt):
        print("\n[INFO] 🛑 Interrupção detectada. Extraindo dados...")
        scraper.extract_data()
    finally:
        try:
            await scraper.close()
        except PlaywrightError:
            # Ignora o erro se o driver já tiver sido fechado à força pelo SO
            pass
        except Exception as e:
            print(f"[WARN] Erro ao fechar scraper: {e}")


if __name__ == "__main__":
    # Teste Rápido para um único perfil
    URL_TESTE = "https://www.linkedin.com/in/monicasbusatta/"
    print(f"Iniciando scraper individual para: {URL_TESTE}")
    bot = ProfileScraper(target_url=URL_TESTE)

    try:
        asyncio.run(run_scraper_instance(bot))
    except KeyboardInterrupt:
        print("\n[SISTEMA] Encerrado pelo usuário.")
