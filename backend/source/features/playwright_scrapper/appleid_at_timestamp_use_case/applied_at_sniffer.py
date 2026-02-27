import asyncio
import json
import re
from datetime import datetime, timezone
from playwright.async_api import Request, Response

from source.features.playwright_scrapper.linkedin_core import LinkedInBrowserSniffer


class VoyagerHunter(LinkedInBrowserSniffer):
    KEYWORDS = [
        "voyager/api/graphql",
        "jobs",
        "tracker",
        "searchDashClusters",
        "jobPosting",
    ]

    SEARCH_FIELDS = [
        "applied",
        "submitted",
        "application",
        "epoch",
        "created",
        "time",
    ]

    def __init__(self, target_url: str):
        super().__init__(target_url)
        self.seen = set()
        self.probed_jobs = set()

    # =======================================================
    # REQUEST LOGGER
    # =======================================================

    async def handle_request(self, request: Request):

        url = request.url.lower()

        if not any(k in url for k in self.KEYWORDS):
            return

        key = f"{request.method}:{url}:{request.post_data}"
        if key in self.seen:
            return
        self.seen.add(key)

        print("\n" + "=" * 150)
        print("🚀 REQUEST DETECTADO")
        print("URL:", request.url)
        print("METHOD:", request.method)

        headers = request.headers

        curl = f"curl '{request.url}' \\\n"
        for h, v in headers.items():
            curl += f"  -H '{h}: {v}' \\\n"

        if request.post_data:
            curl += f"  --data-raw '{request.post_data}'"

        print("\n🧪 CURL:")
        print(curl)
        print("=" * 150)

    # =======================================================
    # RESPONSE SCANNER
    # =======================================================

    async def handle_response(self, response: Response):

        url = response.url.lower()

        if not any(k in url for k in self.KEYWORDS):
            return

        try:
            text = await response.text()
        except:
            return

        if not text:
            return

        if "searchDashClusters" not in text:
            return

        matches = []

        for field in self.SEARCH_FIELDS:
            if field.lower() in text.lower():
                matches.append(field)

        if matches:
            print("\n" + "=" * 150)
            print("🔥 POSSÍVEL CAMPO INTERESSANTE ENCONTRADO")
            print("URL:", response.url)
            print("MATCHES:", list(set(matches)))
            print("\n📄 RESPONSE (primeiros 2000 chars):")
            print(text[:2000])
            print("=" * 150)

    # =======================================================
    # NOVA PARTE — PROBE AUTOMÁTICO DO jobPostings
    # =======================================================

    async def probe_job_postings(self):

        print("\n🔍 Executando probe automático de jobPostings...\n")

        page = self.page

        # ==========================================================
        # 1️⃣ Coletar Job IDs da página atual
        # ==========================================================

        content = await page.content()

        job_ids = list(set(re.findall(r'/jobs/view/(\d+)', content)))

        if not job_ids:
            print("❌ Nenhum jobId encontrado na página.")
            return

        print(f"🎯 Job IDs encontrados: {job_ids[:10]}\n")

        # ==========================================================
        # 2️⃣ Testar endpoint voyager/api/jobs/jobPostings/{id}
        # ==========================================================

        for job_id in job_ids[:10]:

            print(f"🔎 Testando voyager/api/jobs/jobPostings/{job_id}")

            result = await page.evaluate("""
                                         async (jobId) => {

                                             // ---------------------------------------------
                                             // Extrair CSRF do cookie JSESSIONID
                                             // ---------------------------------------------
                                             const jsession = document.cookie
                                                 .split('; ')
                                                 .find(row => row.startsWith('JSESSIONID='));

                                             let csrf = null;

                                             if (jsession) {
                                                 csrf = jsession.split('=')[1].replace(/"/g, '');
                                             }

                                             // ---------------------------------------------
                                             // Executar fetch autenticado
                                             // ---------------------------------------------
                                             const res = await fetch(`/voyager/api/jobs/jobPostings/${jobId}`, {
                                                 method: "GET",
                                                 headers: {
                                                     "accept": "application/json",
                                                     "x-restli-protocol-version": "2.0.0",
                                                     "csrf-token": csrf
                                                 },
                                                 credentials: "include"
                                             });

                                             const text = await res.text();

                                             return {
                                                 status: res.status,
                                                 text: text
                                             };
                                         }
                                         """, job_id)

            print("STATUS:", result["status"])

            if result["status"] == 200:

                text = result["text"]

                # ---------------------------------------------
                # Procurar appliedAt
                # ---------------------------------------------
                match = re.search(r'"appliedAt"\s*:\s*(\d+)', text)

                if match:
                    timestamp_ms = int(match.group(1))

                    from datetime import datetime, timezone
                    dt = datetime.fromtimestamp(timestamp_ms / 1000.0, tz=timezone.utc)

                    print(f"🔥 FOUND appliedAt: {timestamp_ms}")
                    print(f"📅 Data UTC: {dt}\n")

                    return

                else:
                    print("⚠️ 200 OK mas appliedAt não encontrado.")
                    print(text[:800])
                    print()

            elif result["status"] == 403:
                print("❌ 403 Forbidden (provavelmente csrf ou header extra necessário)\n")

            elif result["status"] == 404:
                print("❌ 404 Not Found (endpoint removido)\n")

            else:
                print("⚠️ Status inesperado\n")

        print("❌ Nenhum appliedAt encontrado via jobPostings endpoint.\n")

    # =======================================================

    async def start(self):
        await self.setup_browser()
        self.setup_listeners()

        print(f"\n🌐 Acessando: {self.target_url}")
        await self.goto_target()

        await asyncio.sleep(6)

        print("\n🔍 Executando probe automático de jobPostings...\n")
        await self.probe_job_postings()

        print("\n🔍 Voyager Hunter ativo (modo interativo)")
        print("➡ Clique em aplicações")
        print("➡ Role a página")
        print("➡ Observe logs\n")

        try:
            while True:
                await asyncio.sleep(0.5)
        except KeyboardInterrupt:
            await self.close()


if __name__ == "__main__":
    ALVO = "https://www.linkedin.com/jobs-tracker/?stage=applied"
    bot = VoyagerHunter(ALVO)
    asyncio.run(bot.start())
