# backend/source/features/friends_connections/fetch_connections.py

import time
import json
import re
from typing import List, Dict, Any

from database.database_connection import get_db_session
from models.fetch_models import FetchCurl
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
            raise ValueError("Configuração 'Connections' não encontrada. Salve no painel React primeiro.")

        db = get_db_session()
        try:
            record = db.query(FetchCurl).filter(FetchCurl.name == "Connections").first()
            self.url = record.base_url
            self.method = record.method or "POST"
            self.base_body_str = record.body or ""
        finally:
            db.close()

    def fetch_all(self, batch_size: int = 10, max_pages: int = 50) -> List[Dict]:
        all_connections = []
        start_index = 0
        pages_fetched = 0
        has_more = True

        while has_more and pages_fetched < max_pages:
            if self.debug:
                print(f"🔄 Buscando conexões [Offset: {start_index}]...")

            # Injeta paginação
            current_payload = self.base_body_str.replace("{START_INDEX}", str(start_index))

            req = RawStringRequest(
                method=self.method,
                url=self.url,
                body_str=current_payload,
                debug=self.debug
            )

            response = self.client.execute(req)

            if response.status_code != 200:
                print(f"❌ Falha no LinkedIn API (Status {response.status_code})")
                break

            content_type = response.headers.get("Content-Type", "")

            # ---------------------------------------------------------
            # 1. PARSE DA RESPOSTA (Gera Dicionário Bruto)
            # ---------------------------------------------------------
            if "application/octet-stream" in content_type:
                # É um RSC Stream. Não vamos usar _parse_sdui_stream_to_dict antigo,
                # vamos empilhar todas as linhas JSON num listão.
                raw_objects = []
                for line in response.text.split('\n'):
                    if not line.strip() or ':' not in line:
                        continue
                    try:
                        _, json_part = line.split(':', 1)
                        raw_objects.append(json.loads(json_part))
                    except:
                        continue
                data = {"rsc_dump": raw_objects}
            else:
                try:
                    clean_text = response.text.lstrip()
                    if clean_text.startswith(")]}'"):
                        clean_text = clean_text.split("\n", 1)[-1]
                    data = json.loads(clean_text)
                except json.JSONDecodeError:
                    break

            # ---------------------------------------------------------
            # 2. EXTRAÇÃO DOS DADOS
            # ---------------------------------------------------------
            extracted = self._extract_profiles(data, is_rsc="application/octet-stream" in content_type)

            if not extracted:
                if self.debug:
                    print("✅ Nenhuma conexão nova retornada (ou falha no parser).")
                has_more = False
            else:
                all_connections.extend(extracted)
                if self.debug:
                    print(f"💎 +{len(extracted)} conexões extraídas. Total: {len(all_connections)}")

                start_index += batch_size
                pages_fetched += 1
                time.sleep(1.5)

        return all_connections

    def _extract_profiles(self, data: Dict, is_rsc: bool) -> List[Dict]:
        """Encaminha os dados brutos para o parser adequado."""
        if is_rsc:
            return self._extract_from_rsc(data.get("rsc_dump", []))
        else:
            return self._extract_from_voyager(data)

    def _extract_from_rsc(self, rsc_dump: List[Any]) -> List[Dict]:
        """
        No formato RSC, as entidades de pessoa (Nome, Url, Imagem) ficam dispersas
        no array. Vamos varrer tudo recursivamente procurando links de perfil.
        """
        connections_map = {}  # Usamos um map(URL -> Dict) para mesclar dados da mesma pessoa

        def _scan(obj):
            if isinstance(obj, list):
                # Detecção de nó de perfil padrão RSC
                # Exemplo: ["$", "$L23", "text-attr-0", {"action": {"actions": [{"value": {"url": {"url": "https://www.linkedin.com/in/rianrodri/"}}}]}}, "Rian Rodrigues"]

                # Procura se algum elemento é a URL do perfil
                profile_url = None
                for item in obj:
                    if isinstance(item, str) and "/in/" in item and "linkedin.com" in item:
                        profile_url = item
                        break
                    if isinstance(item, dict):
                        # Escava fundo nos dicionários
                        url_str = str(item)
                        m = re.search(r"'url':\s*'([^']+/in/[^']+)'", url_str)
                        if m:
                            profile_url = m.group(1)

                if profile_url:
                    profile_url = profile_url.split("?")[0]  # limpa tralhas

                    if profile_url not in connections_map:
                        connections_map[profile_url] = {"name": "", "headline": "", "profile_url": profile_url,
                                                        "image": None, "connected_time": ""}

                    # Se achamos a URL nesse Node da árvore, o nome geralmente está no final da lista
                    # ou o headline está logo em seguida.
                    for val in obj:
                        if isinstance(val, str) and len(val) > 2 and "linkedin.com" not in val and "$L" not in val:
                            val = val.strip()
                            if not connections_map[profile_url]["name"] and len(val.split()) <= 4:
                                connections_map[profile_url]["name"] = val
                            elif not connections_map[profile_url]["headline"] and len(val) > 10:
                                connections_map[profile_url]["headline"] = val

                # Continua escaneando os filhos
                for item in obj:
                    _scan(item)

            elif isinstance(obj, dict):
                # Detecção de Imagem
                # Exemplo: {"rootUrl": "...", "imageRenditions": [{"suffixUrl": "..."}], "assetUrn": "..."}
                if "rootUrl" in obj and "imageRenditions" in obj:
                    try:
                        # Tenta deduzir de quem é essa foto checando o 'a11yText' (ex: "Rian Rodrigues' profile picture")
                        a11y = obj.get("a11yText", "")
                        owner_name = a11y.replace("’s profile picture", "").replace("'s profile picture", "").strip()

                        root = obj["rootUrl"]
                        # Pega a rendição de tamanho 100x100
                        renditions = obj["imageRenditions"]
                        suffix = renditions[0]["suffixUrl"] if renditions else ""
                        full_img = f"{root}{suffix}"

                        # Se acharmos de quem é a foto, tentamos parear
                        if owner_name:
                            for url, p_data in connections_map.items():
                                # Se o nome bater ou a url conter parte do nome
                                if owner_name in p_data["name"] or owner_name.split()[0].lower() in url.lower():
                                    p_data["image"] = full_img
                    except Exception:
                        pass

                # Detecção de Tempo de Conexão
                if "children" in obj and isinstance(obj["children"], list):
                    for child in obj["children"]:
                        if isinstance(child, str) and "Connected on" in child:
                            # Isso fica perdido num nó sem contexto, mas vamos salvar
                            # como último recurso. No RSC é difícil linkar a data à pessoa sem o DOM exato.
                            pass

                            # Continua escaneando
                for value in obj.values():
                    _scan(value)

        # Dispara o scanner na raiz
        _scan(rsc_dump)

        # Filtra os válidos (que tem nome)
        valid_profiles = [p for p in connections_map.values() if p["name"]]
        return valid_profiles

    def _extract_from_voyager(self, data: Dict) -> List[Dict]:
        """Fallback para a API GraphQL antiga (mantido da versão anterior)"""
        profiles = []
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
                        artifacts = attrs.get("detailData", {}).get("nonEntityProfilePicture", {}).get("artifacts", [])
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


if __name__ == "__main__":
    print("🔍 Testando LinkedInConnectionsFetcher Isoladamente...")
    # Desativa warnings pra ficar mais limpo
    import warnings

    warnings.filterwarnings('ignore')

    try:
        fetcher = LinkedInConnectionsFetcher(debug=True)
        # Buscar apenas 1 página pra teste rápido
        connections = fetcher.fetch_all(batch_size=10, max_pages=1)

        print("\n✅ Concluído!")
        for idx, c in enumerate(connections, 1):
            print(f"{idx}. {c['name']}")
            print(f"   Cargo: {c['headline']}")
            print(f"   URL:   {c['profile_url']}")
            print(f"   IMG:   {'Tem foto' if c['image'] else 'Sem foto'}\n")

    except Exception as e:
        print(f"\n❌ Erro fatal: {e}")
