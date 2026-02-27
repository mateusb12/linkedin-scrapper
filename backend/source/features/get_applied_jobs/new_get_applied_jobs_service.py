import json
import re
from datetime import datetime
from database.database_connection import get_db_session
from models.fetch_models import FetchCurl
from source.features.fetch_curl.linkedin_http_client import LinkedInClient, LinkedInRequest


class RawStringRequest(LinkedInRequest):
    def __init__(self, method: str, url: str, body_str: str, debug: bool = False):
        super().__init__(method, url, debug=debug)
        self.body_str = body_str

    def execute(self, session, timeout=15):
        merged_headers = session.headers.copy()
        for k, v in self._headers.items():
            # Remove headers que atrapalham a descompressão automática do requests
            if k.lower() in ["accept-encoding", "content-length"]: continue
            merged_headers[k] = v

        if self.debug:
            print(f"🚀 [REQ] {self.method} {self.url}")

        return session.request(
            method=self.method,
            url=self.url,
            headers=merged_headers,
            data=self.body_str.encode('utf-8') if self.body_str else None,
            timeout=timeout
        )


def parse_linkedin_stream(raw_text: str) -> list:
    """
    Transforma o stream (React Server Components) em uma lista plana de objetos JSON.
    Lida com linhas no formato "ID:JSON" e linhas de JSON puro.
    """
    parsed_items = []
    lines = raw_text.split('\n')

    for line in lines:
        if not line.strip(): continue

        try:
            # Tenta separar ID:JSON (ex: "123:{"key":"val"}")
            if ':' in line and len(line) > 1 and line[0].isalnum():
                parts = line.split(':', 1)
                # Heurística: IDs geralmente são curtos (<20 chars).
                if len(parts[0]) < 20:
                    json_val = json.loads(parts[1])
                    parsed_items.append({"stream_id": parts[0], "content": json_val})
                else:
                    # Se não parecer um ID curto, tenta parsear a linha toda
                    parsed_items.append(json.loads(line))
            else:
                parsed_items.append(json.loads(line))
        except Exception:
            # Ignora linhas de controle ou lixo
            pass

    return parsed_items


def find_job_objects_recursive(data):
    """
    Função 'Furadeira': Entra recursivamente em Listas e Dicionários
    até achar um objeto que pareça uma vaga (tem 'companyName').
    """
    found_jobs = []

    if isinstance(data, dict):
        # BINGO! Achamos um objeto que tem nome de empresa
        if "companyName" in data:
            found_jobs.append(data)

        # Continua procurando nos valores deste dicionário
        for key, value in data.items():
            found_jobs.extend(find_job_objects_recursive(value))

    elif isinstance(data, list):
        # Se for lista, entra em cada item recursivamente
        for item in data:
            found_jobs.extend(find_job_objects_recursive(item))

    return found_jobs


def extract_jobs_from_stream(stream_items: list) -> list:
    """
    Pipeline atualizado para o novo payload do LinkedIn (2026).
    Compatível com:
    - jobTitle (novo)
    - jobId (novo)
    - locationPrimary (novo)
    - title / jobPostingUrn (legacy fallback)
    """

    print("\n" + "=" * 80)
    print("🚨 [EXTRACTOR START]")
    print(f"🔍 Itens de topo recebidos: {len(stream_items)}")
    print("=" * 80)

    jobs = []
    seen_ids = set()
    all_candidates = []

    # 1️⃣ Busca recursiva profunda
    for item in stream_items:
        content = item.get("content", item) if isinstance(item, dict) else item
        found = find_job_objects_recursive(content)
        all_candidates.extend(found)

    print(f"🎯 Total candidatos brutos encontrados: {len(all_candidates)}")

    # 2️⃣ Processamento final
    for idx, data in enumerate(all_candidates):
        try:
            print(f"\n➡️ Processando candidato #{idx}")

            # 🔹 Título (novo + fallback antigo)
            title = data.get("title") or data.get("jobTitle")
            if not title:
                print("⛔ Ignorado: não possui title nem jobTitle")
                continue

            # 🔹 Empresa
            company = data.get("companyName", "Unknown")

            # 🔹 ID (novo + fallback antigo)
            raw_id = (
                    data.get("jobPostingUrn")
                    or data.get("entityUrn")
                    or data.get("jobId")
            )

            if not raw_id:
                unique_str = f"{title}-{company}"
                raw_id = f"gen_{hash(unique_str)}"
                print("⚠️ ID gerado via hash")

            if raw_id in seen_ids:
                print("🔁 Ignorado: ID duplicado")
                continue

            seen_ids.add(raw_id)

            # 🔹 Localização (novo + fallback antigo)
            location = (
                    data.get("location")
                    or data.get("formattedLocation")
                    or data.get("locationPrimary")
                    or ""
            )

            # 🔹 URL da vaga baseada no jobId (novo padrão)
            job_url = ""
            if data.get("jobId"):
                job_url = f"https://www.linkedin.com/jobs/view/{data['jobId']}/"

            # 🔹 Data
            date_str = "Recente"
            timestamp = data.get("listedAt") or data.get("originallyListedAt")
            if timestamp:
                try:
                    dt = datetime.fromtimestamp(int(timestamp) / 1000)
                    date_str = dt.strftime("%Y-%m-%d")
                except:
                    pass

            print(f"✅ Aceito: {title} @ {company}")

            jobs.append({
                "title": title,
                "company": company,
                "location": location,
                "source_id": raw_id,
                "date_posted": date_str,
                "job_url": job_url,
                "company_url": "",
                "apply_method": data.get("currentStageKey", "UNKNOWN")
            })

        except Exception as e:
            print(f"🔥 ERRO processando candidato #{idx}: {e}")

    print("\n" + "=" * 80)
    print(f"🏁 EXTRAÇÃO FINALIZADA — {len(jobs)} JOBS VÁLIDOS")
    print("=" * 80)

    return jobs


class JobTrackerFetcher:
    def __init__(self, debug: bool = False):
        self.debug = debug
        self.client = LinkedInClient("SavedJobs")
        if not self.client.config: raise ValueError("Configuração 'SavedJobs' não encontrada.")

        db = get_db_session()
        try:
            record = db.query(FetchCurl).filter(FetchCurl.name == "SavedJobs").first()
            if not record: raise ValueError("Registro 'SavedJobs' não existe.")
            self.base_url = record.base_url
            self.method = record.method or "POST"
            self.base_body_str = record.body or ""
        finally:
            db.close()

    def fetch_jobs(self, stage: str = "saved") -> dict:
        target_url = self.base_url
        target_body = self.base_body_str

        # Swap de flag (saved <-> applied) para reutilizar o cURL
        if stage != "saved":
            target_url = target_url.replace("stage=saved", f"stage={stage}")
            if target_body:
                target_body = target_body.replace('"stage":"saved"', f'"stage":"{stage}"')
                target_body = target_body.replace('current_page_saved', f'current_page_{stage}')
                target_body = target_body.replace('stage=saved', f'stage={stage}')

        if self.debug:
            print(f"\n🔌 [FETCHER] Disparando request para stage='{stage}'...")

        req = RawStringRequest(self.method, target_url, target_body, self.debug)
        response = self.client.execute(req)

        if response.status_code != 200:
            raise Exception(f"Erro LinkedIn: {response.status_code}")

        try:
            raw_text = response.content.decode("utf-8")
        except:
            raw_text = response.content.decode("latin-1")

        # Pipeline: Parse -> Extração Recursiva
        stream_items = parse_linkedin_stream(raw_text)
        clean_jobs = extract_jobs_from_stream(stream_items)

        return {
            "count": len(clean_jobs),
            "jobs": clean_jobs,
            "stage": stage
        }
