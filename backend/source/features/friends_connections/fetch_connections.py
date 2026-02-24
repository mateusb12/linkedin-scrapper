import time
import json
import re
from typing import List, Dict, Any

from database.database_connection import get_db_session
from models.fetch_models import FetchCurl
from source.features.fetch_curl.linkedin_http_client import (
    LinkedInClient,
    LinkedInRequest,
    ParsedResponse
)


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
            raise ValueError("Configuração 'Connections' não encontrada. Salve no painel React primeiro.")

        db = get_db_session()
        try:
            record = db.query(FetchCurl).filter(FetchCurl.name == "Connections").first()
            self.url = record.base_url
            self.method = record.method or "POST"
            self.base_body_str = record.body or ""
        finally:
            db.close()

    # ============================================================
    # FETCH ALL (limpo, sem parsing)
    # ============================================================

    def fetch_all(self, batch_size: int = 10, max_pages: int = 50) -> List[Dict]:
        all_connections: List[Dict] = []
        start_index = 0
        pages_fetched = 0
        has_more = True

        while has_more and pages_fetched < max_pages:
            if self.debug:
                print(f"🔄 Buscando conexões [Offset: {start_index}]...")

            current_payload = self.base_body_str.replace("{START_INDEX}", str(start_index))

            req = RawStringRequest(
                method=self.method,
                url=self.url,
                body_str=current_payload,
                debug=self.debug
            )

            # Usa o client "inteligente" que já faz o parsing
            parsed: ParsedResponse = self.client.execute_parsed(req)

            # Escolhe o extractor baseado no formato já decidido pelo client
            if parsed.format == "rsc":
                extracted = self._extract_from_rsc(parsed.data.get("rsc_dump", []))
            else:
                extracted = self._extract_from_voyager(parsed.data)

            if not extracted:
                if self.debug:
                    print("✅ Nenhuma conexão nova retornada.")
                has_more = False
            else:
                all_connections.extend(extracted)
                if self.debug:
                    print(f"💎 +{len(extracted)} conexões extraídas. Total: {len(all_connections)}")

                start_index += batch_size
                pages_fetched += 1
                time.sleep(1.5)

        return all_connections

    # ============================================================
    # RSC Extractor
    # ============================================================

    def _extract_from_rsc(self, rsc_dump: List[Any]) -> List[Dict]:
        """
        No formato RSC, as entidades de pessoa (Nome, Url, Imagem) ficam dispersas
        no array. Vamos varrer tudo recursivamente procurando links de perfil.
        """
        connections_map: Dict[str, Dict[str, Any]] = {}

        def _scan(obj):
            if isinstance(obj, list):
                # Detecta nó de perfil
                profile_url = None

                for item in obj:
                    if isinstance(item, str) and "/in/" in item and "linkedin.com" in item:
                        profile_url = item
                        break
                    if isinstance(item, dict):
                        url_str = str(item)
                        m = re.search(r"'url':\s*'([^']+/in/[^']+)'", url_str)
                        if m:
                            profile_url = m.group(1)

                if profile_url:
                    profile_url = profile_url.split("?")[0]

                    if profile_url not in connections_map:
                        connections_map[profile_url] = {
                            "name": "",
                            "headline": "",
                            "profile_url": profile_url,
                            "image": None,
                            "connected_time": ""
                        }

                    for val in obj:
                        if isinstance(val, str) and len(val) > 2 and "linkedin.com" not in val and "$L" not in val:
                            val = val.strip()
                            if not connections_map[profile_url]["name"] and len(val.split()) <= 4:
                                connections_map[profile_url]["name"] = val
                            elif not connections_map[profile_url]["headline"] and len(val) > 10:
                                connections_map[profile_url]["headline"] = val

                for item in obj:
                    _scan(item)

            elif isinstance(obj, dict):
                # Detecção de imagem de perfil
                if "rootUrl" in obj and "imageRenditions" in obj:
                    try:
                        a11y = obj.get("a11yText", "")
                        owner_name = (
                            a11y.replace("’s profile picture", "")
                            .replace("'s profile picture", "")
                            .strip()
                        )
                        root = obj["rootUrl"]
                        renditions = obj["imageRenditions"]
                        suffix = renditions[0]["suffixUrl"] if renditions else ""
                        full_img = f"{root}{suffix}"

                        if owner_name:
                            for url, p_data in connections_map.items():
                                if owner_name in p_data["name"] or owner_name.split()[0].lower() in url.lower():
                                    p_data["image"] = full_img
                    except Exception:
                        pass

                for value in obj.values():
                    _scan(value)

        _scan(rsc_dump)
        return [p for p in connections_map.values() if p["name"]]

    # ============================================================
    # Voyager Extractor
    # ============================================================

    def _extract_from_voyager(self, data: Dict) -> List[Dict]:
        """Fallback para a API GraphQL antiga (mantido da versão anterior)"""
        profiles: List[Dict[str, Any]] = []
        included = data.get("included", [])
        for item in included:
            if "title" in item and "primarySubtitle" in item and "navigationUrl" in item:
                profile_url = item.get("navigationUrl", "").split("?")[0]
                if "/in/" not in profile_url:
                    continue

                image_url = None
                if "image" in item and "attributes" in item["image"]:
                    try:
                        attrs = item["image"]["attributes"][0]
                        root_url = item["image"].get("rootUrl", "")
                        artifacts = (
                            attrs.get("detailData", {})
                            .get("nonEntityProfilePicture", {})
                            .get("artifacts", [])
                        )
                        if artifacts:
                            image_url = root_url + artifacts[0].get("fileIdentifyingUrlPathSegment", "")
                    except Exception:
                        pass

                profiles.append({
                    "name": item.get("title", {}).get("text", "Unknown"),
                    "headline": item.get("primarySubtitle", {}).get("text", ""),
                    "connected_time": item.get("secondarySubtitle", {}).get("text", ""),
                    "profile_url": profile_url,
                    "image": image_url
                })

        return profiles


# ============================================================
# TESTE ISOLADO
# ============================================================

if __name__ == "__main__":
    print("🔍 Testando LinkedInConnectionsFetcher Isoladamente...")
    import warnings

    warnings.filterwarnings('ignore')

    try:
        fetcher = LinkedInConnectionsFetcher(debug=True)
        # Buscar apenas 1 página pra teste rápido
        connections = fetcher.fetch_all(batch_size=10, max_pages=1)

        print("\n✅ Concluído!")
        for idx, c in enumerate(connections, 1):
            print(f"{idx}. {c.get('name')}")
            print(f"   Cargo: {c.get('headline')}")
            print(f"   URL:   {c.get('profile_url')}")
            print(f"   IMG:   {'Tem foto' if c.get('image') else 'Sem foto'}\n")

    except Exception as e:
        print(f"\n❌ Erro fatal: {e}")
