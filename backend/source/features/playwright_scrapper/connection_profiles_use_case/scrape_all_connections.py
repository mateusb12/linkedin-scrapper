import asyncio
import re
import html
from pathlib import Path

# Importa o geralzão
from base_list_sniffer import BaseListSniffer


class LiveConnectionsSniffer(BaseListSniffer):
    def __init__(self):
        # Passa a URL alvo direto pro pai
        super().__init__("https://www.linkedin.com/mynetwork/invite-connect/connections/")

    def is_target_endpoint(self, url: str) -> bool:
        # Só deixa passar as requisições que tem a ver com conexões
        return "connectionsList" in url or "mynetwork/invite-connect" in url

    def extract_data_from_text(self, text: str) -> int:
        found = 0
        text = html.unescape(text)

        # Regex para extrair os slugs do payload
        for m in re.findall(r'https://www\.linkedin\.com/in/([A-Za-z0-9\-_]+)/?', text):
            self.collected_items[m] = f"https://www.linkedin.com/in/{m}/"
            found += 1

        for m in re.findall(r'"publicIdentifier"\s*:\s*"([^"]+)"', text):
            self.collected_items[m] = f"https://www.linkedin.com/in/{m}/"
            found += 1

        for m in re.findall(r'"vanityName"\s*:\s*"([^"]+)"', text):
            self.collected_items[m] = f"https://www.linkedin.com/in/{m}/"
            found += 1

        return found

    def save_results(self):
        if not self.collected_items:
            print("\n⚠ Nenhuma conexão encontrada!")
            return

        final = sorted(self.collected_items.values())
        output = Path("../minhas_conexoes.txt")
        output.write_text("\n".join(final), encoding="utf-8")

        print(f"\n🎉 Total final: {len(final)} conexões")
        print(f"💾 Salvo em: {output.absolute()}")


if __name__ == "__main__":
    bot = LiveConnectionsSniffer()
    asyncio.run(bot.start())
