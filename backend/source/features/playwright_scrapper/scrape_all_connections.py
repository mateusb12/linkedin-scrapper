import asyncio
import re
import html
import sys
from pathlib import Path

# Importa toda a inteligência construída no arquivo 1
from scrape_single_profile import LinkedInBrowserSniffer, ProfileScraper, run_scraper_instance


class ConnectionsScraper(LinkedInBrowserSniffer):
    """Extrator focado em listar as conexões (Gera o TXT)."""

    def __init__(self, target_url: str = "https://www.linkedin.com/mynetwork/invite-connect/connections/",
                 user_data_dir: str = "linkedin_profile"):
        super().__init__(target_url, user_data_dir)

    async def handle_response(self, response):
        url = response.url
        if response.request.resource_type in ("xhr", "fetch") or (
                "linkedin.com/mynetwork" in url and response.request.resource_type == "document"):
            try:
                body_bytes = await response.body()
                decoded = self.try_decode(body_bytes)
                if decoded: self.pool_texts.append(decoded)
            except Exception:
                pass

    def extract_data(self):
        if self._processed: return
        self._processed = True

        print(f"\n[GARIMPO] Procurando conexões em {len(self.pool_texts)} requisições capturadas...")
        conexoes = {}

        for text in self.pool_texts:
            texto_limpo = html.unescape(text)
            for linha in texto_limpo.split('\n'):
                slug_match = re.search(r'"vanityName"\s*:\s*"([^"]+)"', linha)
                url_match = re.search(r'"url"\s*:\s*"(https://www\.linkedin\.com/in/[^/]+/?)"', linha)

                if slug_match:
                    slug = slug_match.group(1)
                    if slug not in conexoes and slug != "UNKNOWN":
                        conexoes[slug] = {"url": f"https://www.linkedin.com/in/{slug}/"}
                elif url_match:
                    url_completa = url_match.group(1)
                    slug = url_completa.strip('/').split('/')[-1]
                    if slug not in conexoes and slug != "UNKNOWN":
                        conexoes[slug] = {"url": url_completa}

        if not conexoes:
            print("⚠️ Nenhuma conexão encontrada. Você rolou a página de conexões?")
            return

        lista_final = sorted(list(conexoes.values()), key=lambda x: x['url'])
        output_file = Path("minhas_conexoes.txt")

        with output_file.open("w", encoding="utf-8") as f:
            for c in lista_final:
                f.write(f"{c['url']}\n")

        print(f"🎉 SUCESSO! {len(lista_final)} conexões capturadas e salvas em {output_file.name}")

    async def start(self):
        await self.setup_browser()
        self.setup_listeners()
        await self.goto_target()
        print("\n[INFO] 🕵️‍♂️ Extrator de Conexões Ativado!")
        print("[INFO] Role a página para baixo e aperte Stop (ou CTRL+C) para exportar o .txt.\n")
        await asyncio.sleep(999999)


async def main():
    print("=" * 50)
    print(" 🕵️‍♂️ LINKEDIN MULTI-SCRAPER")
    print("=" * 50)
    print("[1] Gerar arquivo de conexões (minhas_conexoes.txt)")
    print("[2] Iniciar Loop de mineração de perfis (Lê o .txt)")
    print("=" * 50)

    escolha = input("Digite 1 ou 2: ").strip()

    if escolha == "1":
        bot = ConnectionsScraper()
        await run_scraper_instance(bot)

    elif escolha == "2":
        arquivo = Path("minhas_conexoes.txt")
        if not arquivo.exists():
            print("\n⚠️ Erro: Arquivo 'minhas_conexoes.txt' não encontrado.")
            print("Rode a opção [1] primeiro para gerar a lista.")
            sys.exit(1)

        with arquivo.open("r", encoding="utf-8") as f:
            urls = [linha.strip() for linha in f if "linkedin.com/in/" in linha]

        print(f"\n[INFO] Iniciando o Loop em {len(urls)} perfis...")
        print("[DICA] Aperte CTRL+C / Stop na IDE para minerar o perfil atual e ir pro próximo.\n")

        for index, url in enumerate(urls, start=1):
            print(f"\n[{index}/{len(urls)}] 🚀 Abrindo: {url}")

            # Instancia o scraper importado do arquivo 1
            bot = ProfileScraper(target_url=url)
            await run_scraper_instance(bot)

            print(f"[{index}/{len(urls)}] ✅ Perfil concluído. Preparando o próximo...")
            await asyncio.sleep(1.5)

    else:
        print("Opção inválida. Saindo...")


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n[SISTEMA] Execução total encerrada pelo usuário.")
