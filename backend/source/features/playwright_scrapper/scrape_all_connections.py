import asyncio
import re
import html
from pathlib import Path

from linkedin_core import LinkedInBrowserSniffer


class LiveConnectionsSniffer(LinkedInBrowserSniffer):
    """
    Sniffer que:
      ✔ usa sua persistência
      ✔ não quebra login
      ✔ captura apenas requests novas
      ✔ extrai slugs das conexões em QUALQUER payload
    """

    def __init__(self, target_url="https://www.linkedin.com/mynetwork/invite-connect/connections/"):
        super().__init__(target_url)
        self.connections = {}
        self.seen_urls = set()

    # ---------------------------------------------------------------------

    def extract_slugs_from_text(self, text: str) -> int:
        """Tenta extrair qualquer slug útil do payload."""
        found = 0
        text = html.unescape(text)

        # 1) URLs diretas
        for m in re.findall(r'https://www\.linkedin\.com/in/([A-Za-z0-9\-_]+)/?', text):
            slug = m
            self.connections[slug] = f"https://www.linkedin.com/in/{slug}/"
            found += 1

        # 2) publicIdentifier
        for m in re.findall(r'"publicIdentifier"\s*:\s*"([^"]+)"', text):
            slug = m
            self.connections[slug] = f"https://www.linkedin.com/in/{slug}/"
            found += 1

        # 3) vanityName
        for m in re.findall(r'"vanityName"\s*:\s*"([^"]+)"', text):
            slug = m
            self.connections[slug] = f"https://www.linkedin.com/in/{slug}/"
            found += 1

        return found

    # ---------------------------------------------------------------------

    async def handle_response(self, response):
        """Intercepta cada resposta nova, filtra o lixo e extrai slugs."""
        url = response.url

        # 1. Early returns para evitar requests inúteis ou repetidas
        if url in self.seen_urls:
            return

        # 2. Ignorar redirecionamentos (Evita o erro "unavailable for redirect responses")
        if response.status >= 300 and response.status <= 399:
            return

        # 3. Filtrar apenas tráfego útil (ignorar imagens, css, fontes, etc)
        # O LinkedIn manda os dados via XHR/Fetch ou embutido no Document principal
        if response.request.resource_type not in ["xhr", "fetch", "document"]:
            return

        self.seen_urls.add(url)

        try:
            # 4. Lê o body apenas das requests que passaram nos filtros
            body_bytes = await response.body()
            decoded = self.try_decode(body_bytes)

            if not decoded:
                return

            # 5. Otimização: Só processar regex se a URL for o endpoint correto
            # ou a página inicial de conexões.
            if "connectionsList" in url or "mynetwork/invite-connect" in url:
                qtd = self.extract_slugs_from_text(decoded)

                if qtd > 0:
                    print(f"\n==============================")
                    print(f"📡 DADOS ENCONTRADOS")
                    print(f"URL: {url}")
                    print(f"💎 {qtd} conexões extraídas!")
                    print(f"==============================\n")

        except Exception as e:
            # Captura erros residuais (ex: target closed) silenciosamente ou loga para debug
            pass

    # ---------------------------------------------------------------------

    def save_results(self):
        """Salvar minhas_conexoes.txt"""
        if not self.connections:
            print("\n⚠ Nenhuma conexão encontrada!")
            return

        final = sorted(self.connections.values())
        output = Path("minhas_conexoes.txt")
        output.write_text("\n".join(final), encoding="utf-8")

        print(f"\n🎉 Total final: {len(final)} conexões")
        print(f"💾 Salvo em: {output.absolute()}")

    # ---------------------------------------------------------------------

    async def start(self):
        """Fluxo real: abrir, sniffar e esperar scroll manual."""
        await self.setup_browser()
        self.setup_listeners()

        print("\n🌐 Acesse a página de conexões…")
        await self.goto_target()

        print("\n🤖 Sniffer ligado!")
        print("➡ Role manualmente a página")
        print("➡ Cada nova CURL será capturada")
        print("➡ Aperte CTRL+C para finalizar\n")

        try:
            while True:
                await asyncio.sleep(0.5)
        except KeyboardInterrupt:
            print("\n🔻 Encerrando captura…")
            self.save_results()
            await self.close()


# ---------------------------------------------------------------------

async def main():
    bot = LiveConnectionsSniffer()
    await bot.start()


if __name__ == "__main__":
    asyncio.run(main())
