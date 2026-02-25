# backend/source/features/friends_connections/fetch_connections.py

import time
import json
import re
from typing import List, Dict, Any

from database.database_connection import get_db_session
from models.fetch_models import FetchCurl
from models.connection_models import LinkedInConnection
from source.features.fetch_curl.linkedin_http_client import LinkedInClient, LinkedInRequest


class RawStringRequest(LinkedInRequest):
    def __init__(self, method: str, url: str, body_str: str, debug: bool = False):
        super().__init__(method, url, debug=debug)
        self.body_str = body_str

    def execute(self, session, timeout=15):
        merged_headers = session.headers.copy()
        merged_headers.update(self._headers)
        return session.request(
            method=self.method,
            url=self.url,
            headers=merged_headers,
            data=self.body_str.encode('utf-8') if self.body_str else None,
            timeout=timeout
        )


class LinkedInConnectionsFetcher:
    def __init__(self, debug: bool = False):
        self.debug = debug
        self.client = LinkedInClient("Connections")

        if not self.client.config:
            raise ValueError("Configuração 'Connections' não encontrada no banco.")

        db = get_db_session()
        try:
            record = db.query(FetchCurl).filter(FetchCurl.name == "Connections").first()
            self.url = record.base_url
            self.method = record.method or "POST"
            self.base_body_str = record.body or ""
        finally:
            db.close()

    def fetch_all(self, batch_size: int = 10, max_pages: int = 50) -> List[Dict]:
        """Varre as páginas, salva as URLs no banco e E-MITE EVENTOS em tempo real."""
        db = get_db_session()
        try:
            start_index = 0
            pages_fetched = 0
            has_more = True
            found_existing = False
            new_conns = 0

            yield {"status": "start", "message": "Iniciando varredura na rede de contatos..."}

            while has_more and pages_fetched < max_pages and not found_existing:
                yield {"status": "progress", "message": f"Lendo página de conexões {pages_fetched + 1}..."}

                current_payload = self.base_body_str.replace("{START_INDEX}", str(start_index))
                req = RawStringRequest(method=self.method, url=self.url, body_str=current_payload, debug=False)
                response = self.client.execute(req)

                if response.status_code != 200:
                    yield {"status": "error", "message": f"🚨 Erro do LinkedIn: Status {response.status_code}"}
                    break

                content_type = response.headers.get("Content-Type", "")

                # --- Formata a Resposta ---
                if "application/octet-stream" in content_type:
                    raw_objects = []
                    for line in response.text.split('\n'):
                        if not line.strip() or ':' not in line: continue
                        try:
                            _, json_part = line.split(':', 1)
                            raw_objects.append(json.loads(json_part))
                        except Exception:
                            pass
                    data = {"rsc_dump": raw_objects}
                else:
                    try:
                        clean_text = response.text.lstrip()
                        if clean_text.startswith(")]}'"):
                            clean_text = clean_text.split("\n", 1)[-1]
                        data = json.loads(clean_text)
                    except json.JSONDecodeError:
                        break

                # --- Extrai as URLs ---
                extracted_profiles = self._extract_profiles(data, is_rsc="application/octet-stream" in content_type)

                if not extracted_profiles:
                    yield {"status": "info", "message": "Fim da rede alcançado."}
                    has_more = False
                    break

                # --- PERSISTÊNCIA (CACHE INTELIGENTE) ---
                for prof in extracted_profiles:
                    p_url = prof["profile_url"]
                    existing = db.query(LinkedInConnection).filter_by(profile_url=p_url).first()

                    if existing:
                        found_existing = True
                        break
                    else:
                        v_name = None
                        m = re.search(r'/in/([^/]+)', p_url)
                        if m: v_name = m.group(1)
                        display_name = v_name.replace('-', ' ').title() if v_name else "LinkedIn Connection"

                        new_conn = LinkedInConnection(
                            profile_url=p_url, name=display_name, headline="1st Degree Connection",
                            image_url=None, connected_time="", vanity_name=v_name, is_fully_scraped=False
                        )
                        db.add(new_conn)
                        new_conns += 1

                db.commit()

                if found_existing:
                    yield {"status": "info", "message": "Conexões antigas encontradas. Encerrando varredura."}
                    break

                start_index += batch_size
                pages_fetched += 1

                yield {"status": "wait", "message": "Pausa anti-block..."}
                time.sleep(1.5)

            yield {"status": "complete", "message": f"Varredura finalizada. +{new_conns} perfis novos adicionados."}

        except Exception as e:
            db.rollback()
            yield {"status": "error", "message": f"Falha na varredura: {str(e)}"}
        finally:
            db.close()

    def _extract_profiles(self, data: Dict, is_rsc: bool) -> List[Dict]:
        if is_rsc:
            return self._extract_from_rsc(data.get("rsc_dump", []))
        return self._extract_from_voyager(data)

    def _extract_from_rsc(self, rsc_dump: List[Any]) -> List[Dict]:
        """Acha qualquer link do linkedin que seja de perfil e salva como dummy"""
        connections_map = {}

        def _scan(obj):
            if isinstance(obj, list):
                for item in obj:
                    if isinstance(item, dict):
                        url_str = str(item)
                        m = re.search(r"'url':\s*'([^']+/in/[^']+)'", url_str)
                        if m:
                            profile_url = m.group(1).split("?")[0]
                            if profile_url not in connections_map:
                                connections_map[profile_url] = {
                                    "name": "div",
                                    "headline": "text-attr-0",
                                    "profile_url": profile_url,
                                    "image": None,
                                    "connected_time": ""
                                }
                for item in obj:
                    _scan(item)
            elif isinstance(obj, dict):
                for value in obj.values():
                    _scan(value)

        _scan(rsc_dump)
        return list(connections_map.values())

    def _extract_from_voyager(self, data: Dict) -> List[Dict]:
        profiles = []
        included = data.get("included", [])

        for item in included:
            if "navigationUrl" in item:
                profile_url = item.get("navigationUrl", "").split("?")[0]
                if "/in/" not in profile_url:
                    continue
                profiles.append({
                    "name": "div",
                    "headline": "text-attr-0",
                    "connected_time": "",
                    "profile_url": profile_url,
                    "image": None
                })

        unique_profiles = {p['profile_url']: p for p in profiles}.values()
        return list(unique_profiles)
