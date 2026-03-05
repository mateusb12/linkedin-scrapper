import asyncio
from typing import List
from playwright.async_api import Request

# Ajuste o import se necessário, dependendo de onde está rodando
from linkedin_core import LinkedInBrowserSniffer


class BaseListSniffer(LinkedInBrowserSniffer):
    """
    Classe base genérica para interceptação de listas e páginas dinâmicas no LinkedIn.
    """

    def __init__(self, target_url: str):
        super().__init__(target_url)
        self.seen_urls = set()
        self.collected_items = {}

        # ==========================================

    # MÉTODOS ABSTRATOS
    # ==========================================
    def is_target_endpoint(self, url: str) -> bool:
        raise NotImplementedError

    def extract_data_from_text(self, text: str, request: Request) -> int:
        raise NotImplementedError

    def save_results(self):
        raise NotImplementedError

    # ==========================================
    # LÓGICA CORE DE INTERCEPTAÇÃO
    # ==========================================
    async def handle_response(self, response):
        url = response.url

        if url in self.seen_urls: return
        if response.status >= 300 and response.status <= 399: return
        if response.request.resource_type not in ["xhr", "fetch", "document"]: return

        self.seen_urls.add(url)

        try:
            body_bytes = await response.body()
            decoded = self.try_decode(body_bytes)

            if not decoded: return

            if self.is_target_endpoint(url):
                # Passamos o request também para caso a classe filha queira gerar um cURL
                self.extract_data_from_text(decoded, response.request)
        except Exception:
            pass

    async def start(self):
        await self.setup_browser()
        self.setup_listeners()

        print(f"\n🌐 Acessando: {self.target_url}")
        await self.goto_target()

        print("\n🤖 Sniffer ligado!")
        print("➡ Navegue e force o carregamento dos dados.")
        print("➡ Aperte CTRL+C para finalizar e processar os resultados.\n")

        try:
            while True:
                await asyncio.sleep(0.5)
        except (KeyboardInterrupt, asyncio.CancelledError):
            print("\n🔻 Encerrando e consolidando dados…")
            self.save_results()
            try:
                await self.close()
            except Exception:
                pass


# =================================================================
# BLOCO DE EXECUÇÃO: CAÇADOR DE STRINGS (DESCOBERTA DE ENDPOINTS)
# =================================================================
if __name__ == "__main__":

    class StringHunterSniffer(BaseListSniffer):
        def __init__(self, target_url: str, desired_string: str):
            super().__init__(target_url)
            self.desired_string = desired_string
            self.matched_requests: List[Request] = []

        def is_target_endpoint(self, url: str) -> bool:
            # Queremos analisar TODOS os endpoints XHR/Fetch para achar a string
            # Ignoramos apenas arquivos estáticos óbvios
            if any(ext in url for ext in [".js", ".css", ".png", ".jpg", ".svg", "tracking"]):
                return False
            return True

        def extract_data_from_text(self, text: str, request: Request) -> int:
            if self.desired_string in text:
                print(f"🎯 BINGO! String encontrada na URL: {request.url.split('?')[0][-50:]}")
                self.matched_requests.append(request)
                return 1
            return 0

        def request_to_curl(self, req: Request) -> str:
            """Gera um comando cURL funcional a partir de um request do Playwright"""
            curl_cmd = f"curl '{req.url}' \\\n"
            curl_cmd += f"  -X '{req.method}' \\\n"

            for k, v in req.headers.items():
                if k.lower() in ["accept-encoding", "content-length"]:
                    continue  # Deixa o cURL/requests gerenciar isso
                v_esc = v.replace("'", "\\'")
                curl_cmd += f"  -H '{k}: {v_esc}' \\\n"

            if req.post_data:
                data_esc = req.post_data.replace("'", "\\'")
                curl_cmd += f"  --data-raw '{data_esc}'"

            return curl_cmd.strip()

        def save_results(self):
            if not self.matched_requests:
                print(f"\n⚠ A string '{self.desired_string}' não foi encontrada em nenhum payload de rede.")
                return

            print(f"\n🔥 {len(self.matched_requests)} payloads contêm a string procurada!\n")
            print("=" * 60)

            for i, req in enumerate(self.matched_requests, 1):
                print(f"[{i}] Endpoint: {req.url.split('?')[0]}")
                print(self.request_to_curl(req))
                print("\n" + "-" * 60 + "\n")


    # Parâmetros da sua busca
    ALVO_URL = "https://www.linkedin.com/jobs/view/4375526458/?refId=c29b0c61-5d2e-38a3-ac1e-25409a92c3d2"
    ISCA = "viewed"

    # Inicia a caçada
    bot = StringHunterSniffer(target_url=ALVO_URL, desired_string=ISCA)

    try:
        asyncio.run(bot.start())
    except KeyboardInterrupt:
        # Pega a rebarba do Ctrl+C no nível principal e encerra limpo sem estourar o terminal
        pass
