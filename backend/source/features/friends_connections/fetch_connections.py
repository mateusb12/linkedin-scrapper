# backend/source/features/friends_connections/fetch_connections.py

import time
import json
import requests
from typing import List, Dict
from database.database_connection import get_db_session
from models.fetch_models import FetchCurl


class LinkedInConnectionsFetcher:
    def __init__(self):
        self.session = requests.Session()

    def _parse_response_json(self, response: requests.Response) -> Dict:
        """
        Faz o parse seguro do JSON vindo do LinkedIn.
        Trata prefixo XSSI tipo `)]}'` e gera um erro mais legível se der ruim.
        """
        raw = response.text.lstrip()

        # Muitos endpoints do LinkedIn usam prefixo de segurança XSSI (ex: ")]}'\n")
        if raw.startswith(")]}'"):
            # Remove a primeira linha inteira
            parts = raw.split("\n", 1)
            raw = parts[1] if len(parts) > 1 else ""
            raw = raw.lstrip()

        try:
            return json.loads(raw)
        except json.JSONDecodeError as e:
            snippet = raw[:300]
            raise ValueError(
                f"Falha ao parsear JSON do LinkedIn: {e}. "
                f"Trecho inicial da resposta: {snippet!r}"
            ) from e

    def fetch_all(self, batch_size: int = 10, max_pages: int = 50) -> List[Dict]:
        """
        Busca o template 'Connections' no banco e roda a paginação até acabar as conexões.

        OBS IMPORTANTE:
        - Este código assume que o endpoint configurado em fetch_curl.name == "Connections"
          devolve JSON (Content-Type application/json ou similar).
        - Se o endpoint for RSC / Flight (application/octet-stream com linhas tipo "1:I[...]"),
          será lançada uma ValueError explicando que você precisa trocar a URL no banco.
        """
        db = get_db_session()

        try:
            record = (
                db.query(FetchCurl)
                .filter(FetchCurl.name == "Connections")
                .first()
            )
            if not record:
                raise ValueError(
                    "Configuração 'Connections' não encontrada no banco de dados."
                )

            url = record.base_url
            method = (record.method or "POST").upper()

            if not url:
                raise ValueError("URL inválida na configuração de Connections.")

            # headers está em JSON válido no banco (como vimos no SELECT)
            headers = json.loads(record.headers) if record.headers else {}

            base_body_str = record.body or ""
            if not base_body_str:
                raise ValueError("Body inválido na configuração de Connections.")

            all_connections: List[Dict] = []
            start_index = 0
            pages_fetched = 0
            has_more = True

            while has_more and pages_fetched < max_pages:
                print(f"🔄 Buscando conexões [Offset: {start_index}]...")

                # Substitui o placeholder {START_INDEX} pelo valor atual
                current_payload = base_body_str.replace("{START_INDEX}", str(start_index))

                req = requests.Request(
                    method=method,
                    url=url,
                    headers=headers,
                    data=current_payload.encode("utf-8"),
                )
                prepared = self.session.prepare_request(req)

                response = self.session.send(prepared, timeout=15)

                content_type = response.headers.get("Content-Type", "")
                print(f"🔎 Status LinkedIn: {response.status_code}")
                print(f"🔎 Content-Type: {content_type}")

                if response.status_code != 200:
                    snippet = response.text[:300]
                    raise ValueError(
                        f"LinkedIn retornou status {response.status_code}. "
                        f"Trecho da resposta: {snippet!r}"
                    )

                # Se não for JSON, já avisa claramente o problema
                if "json" not in content_type.lower():
                    snippet = response.text[:300]
                    raise ValueError(
                        "O endpoint configurado para 'Connections' não está retornando JSON.\n"
                        f"Content-Type atual: {content_type!r}.\n"
                        "Provavelmente você salvou no banco a URL de um endpoint RSC/Flight "
                        "(`flagship-web/rsc-action`) em vez de um endpoint Voyager (`/voyager/api/...`).\n"
                        "Capture no DevTools um request que tenha 'included' no JSON (Voyager), "
                        "e use essa URL/base/body na tabela fetch_curl.\n"
                        f"Trecho da resposta atual: {snippet!r}"
                    )

                try:
                    data = response.json()
                except ValueError as e:
                    snippet = response.text[:300]
                    raise ValueError(
                        f"Falha ao parsear JSON do LinkedIn: {e}. "
                        f"Trecho inicial da resposta: {snippet!r}"
                    ) from e

                # Aqui assume que o endpoint Voyager devolve algo com 'included'
                extracted = self._extract_profiles(data)

                if not extracted:
                    print("✅ Nenhuma conexão nova retornada. Fim da lista!")
                    has_more = False
                else:
                    all_connections.extend(extracted)
                    print(
                        f"💎 +{len(extracted)} conexões extraídas. "
                        f"Total acumulado: {len(all_connections)}"
                    )
                    start_index += batch_size
                    pages_fetched += 1

                    # Evita bater forte demais no LinkedIn
                    time.sleep(1.5)

            return all_connections

        except Exception as e:
            print(f"❌ Erro durante o fetch das conexões: {str(e)}")
            raise e
        finally:
            db.close()


if __name__ == "__main__":
    print("🔍 Testando LinkedInConnectionsFetcher isoladamente...")

    try:
        fetcher = LinkedInConnectionsFetcher()
        connections = fetcher.fetch_all(batch_size=5, max_pages=1)

        print("\n✅ TESTE CONCLUÍDO COM SUCESSO!")
        print(f"Total conexões extraídas: {len(connections)}")

        # Exibe só as primeiras para não poluir o terminal
        for idx, c in enumerate(connections[:5], start=1):
            print(f"{idx}. {c}")

    except Exception as e:
        print("\n❌ ERRO DURANTE O TESTE:")
        print(str(e))
