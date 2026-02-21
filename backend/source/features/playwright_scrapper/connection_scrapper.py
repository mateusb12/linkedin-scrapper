import asyncio
import json
import re
from pathlib import Path
from urllib.parse import urlparse

from backend.source.features.playwright_scrapper.sniffer import LinkedInBase



class LinkedInProfileGoldDigger(LinkedInBase):
    """
    Sniffer focado em um único perfil.
    Procura por strings específicas (o 'ouro') nas requisições interceptadas
    para descobrirmos quais endpoints trazem os dados do perfil (Experiência, Sobre, etc).
    """

    def __init__(
            self,
            target_url: str,
            gold_strings: dict[str, str],
            user_data_dir: str = "linkedin_profile",
            hits_dir: str = "profile_hits"
    ) -> None:
        super().__init__(target_url=target_url, user_data_dir=user_data_dir)
        self.gold_strings = gold_strings
        self.hits_dir = Path(hits_dir)
        self.hits_dir.mkdir(exist_ok=True)
        self.seen_urls: set[str] = set()

    @staticmethod
    def try_decode(body: bytes) -> str:
        import zlib
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

    @staticmethod
    def pretty_format(text: str) -> str:
        try:
            parsed = json.loads(text)
            return json.dumps(parsed, indent=2, ensure_ascii=False)
        except Exception:
            return text

    async def handle_response(self, response) -> None:
        url = response.url

        if response.request.resource_type not in ("xhr", "fetch"):
            return

        if url in self.seen_urls:
            return

        try:
            body = await response.body()
        except Exception:
            return

        decoded = self.try_decode(body)
        if not decoded:
            return

        found_keys = []
        for key, value in self.gold_strings.items():
            if value.lower() in decoded.lower():
                found_keys.append(key)

        if not found_keys:
            return  

        self.seen_urls.add(url)

        print("\n" + "=" * 60)
        print(f"💰 ACHAMOS OURO! Encontrado: {', '.join(found_keys)}")
        print(f"URL: {url}")
        print("=" * 60)

        parsed_url = urlparse(url)
        safe_path = parsed_url.path.replace("/", "_").strip("_")
        if not safe_path:
            safe_path = "root"

        filename = self.hits_dir / f"hit_{safe_path}_{hash(url) % 10000}.txt"

        with filename.open("w", encoding="utf-8") as f:
            f.write(f"=== OURO ENCONTRADO ===\n{', '.join(found_keys)}\n\n")
            f.write("=== URL ===\n")
            f.write(url + "\n\n")
            f.write("=== METHOD ===\n")
            f.write(response.request.method + "\n\n")
            f.write("=== BODY DECIFRADO ===\n\n")
            f.write(self.pretty_format(decoded))

        print(f"[SALVO] Vá investigar o arquivo: {filename}\n")

    async def _scroll_to_bottom(self) -> None:
        """Rola a página lentamente para forçar o disparo das requisições lazy-load (Experiência, etc)"""
        assert self.page is not None
        print("[SMART SCROLL] Rolando a página para forçar o carregamento das seções...")

        for _ in range(10):
            await self.page.mouse.wheel(0, 1000)
            await self.page.wait_for_timeout(1000)

    async def run(self) -> None:
        await self.setup_browser()
        assert self.page is not None

        self.page.on("response", self.handle_response)

        print(f"[INFO] Acessando {self.target_url}...")
        await self.goto_target()

        await self.page.wait_for_timeout(3000)

        await self._scroll_to_bottom()

        print("[INFO] Terminamos de rolar. Aguardando últimas requisições chegarem (10s)...")
        await self.page.wait_for_timeout(10000)

        await self.close()
        print("[INFO] Finalizado! Verifique a pasta de hits.")


if __name__ == "__main__":
    gold_strings = {
        "Nome e Titulo": "Mônica Busatta",
        "About (Trecho)": "driven by giving the best experience to the user",
        "Experiencia (Empresa)": "Dexian Brasil",
        "Educacao (Faculdade)": "Universidade do Sul de Santa Catarina",
        "Certificado": "MERN eCommerce From Scratch"
    }

    url = "https://www.linkedin.com/in/monicasbusatta/"

    digger = LinkedInProfileGoldDigger(
        target_url=url,
        gold_strings=gold_strings,
        hits_dir="profile_gold_hits"
    )
    asyncio.run(digger.run())
