import json
import os
import time
import random
from dataclasses import asdict

from database.database_connection import get_db_session
from models.connection_models import LinkedInConnection
from source.features.fetch_curl.fetch_service import FetchService
from source.features.playwright_scrapper.analyze_profile import analyze_mega_file, FichaCandidato

import html


def fix_utf8(t: str):
    if not t:
        return t
    # decode entidades HTML (&amp;)
    t = html.unescape(t)
    # tentar corrigir UTF-8 duplo
    try:
        t = t.encode("latin1").decode("utf-8")
    except:
        pass
    return t


class ProfileEnrichmentService:
    def __init__(self, debug=True):
        self.debug = debug

    def enrich_pending_profiles_stream(self, limit=250):
        """Generator que enriquece os perfis e emite eventos SSE de progresso."""
        db = get_db_session()
        try:
            pending_connections = db.query(LinkedInConnection).filter_by(is_fully_scraped=False).order_by(
                LinkedInConnection.name.asc()).limit(limit).all()
            total = len(pending_connections)

            if total == 0:
                yield {"status": "info", "message": "Nenhum perfil pendente para enriquecer."}
                return

            yield {"status": "start", "total": total, "processed": 0,
                   "message": f"Iniciando Enrichment de {total} perfis..."}

            for idx, conn in enumerate(pending_connections):
                yield {"status": "progress", "total": total, "processed": idx,
                       "message": f"Puxando dados de: {conn.name}"}

                # Tenta puxar; se der qualquer sinal de block, ele levanta Exception e cai no except abaixo
                try:
                    raw_data = self._fetch_raw_profile_data(conn.vanity_name)
                except ConnectionError as ce:
                    yield {"status": "error", "message": f"🚨 ABORTADO POR SEGURANÇA: {str(ce)}"}
                    break  # Mata o loop na hora!

                ficha = self._analyze_raw_data(conn.vanity_name, raw_data)

                if ficha:
                    self._update_connection_in_db(db, conn, ficha)
                    db.commit()  # Salva o progresso a cada perfil garantido

                # --- 🛑 JITTER BACKOFF ENTRE PERFIS ---
                if idx < total - 1:
                    delay = random.uniform(0.5, 2.2)  # Pausa média de 4 a 7.5 segs
                    yield {"status": "wait", "total": total, "processed": idx + 1,
                           "message": f"Jitter de {delay:.1f}s para evitar rate-limit..."}
                    time.sleep(delay)

            yield {"status": "complete", "message": f"Processo concluído!"}

        except Exception as e:
            db.rollback()
            yield {"status": "error", "message": f"Erro crítico no loop: {str(e)}"}
        finally:
            db.close()

    def _fetch_raw_profile_data(self, vanity_name: str) -> dict:
        raw_data = {}
        configs_to_fetch = ["ProfileMain", "ProfileAboveActivity", "ProfileBelowActivity"]

        for i, config in enumerate(configs_to_fetch):
            response = FetchService.execute_dynamic_profile_fetch(config_name=config, target_vanity_name=vanity_name)

            # KILL SWITCH: Se o FetchService retornou None, o Linkedin nos barrou (403, 429, etc).
            if not response:
                raise ConnectionError(f"LinkedIn bloqueou a rota '{config}'. Possível Rate-Limit ou Cookie expirado.")

            raw_data[config] = response

            # --- 🛑 JITTER BACKOFF INTERNO ---
            if i < len(configs_to_fetch) - 1:
                time.sleep(random.uniform(0.4, 2.5))  # Pausa curta entre endpoints do mesmo perfil

        return raw_data

    def _analyze_raw_data(self, vanity_name: str, raw_data: dict) -> FichaCandidato:
        temp_file = f"temp_raw_{vanity_name}.json"
        with open(temp_file, 'w', encoding='utf-8') as f:
            json.dump(raw_data, f)

        try:
            ficha = analyze_mega_file(vanity_name, temp_file)
            if os.path.exists(temp_file): os.remove(temp_file)
            return ficha
        except Exception as e:
            if os.path.exists(temp_file): os.remove(temp_file)
            return None

    def _update_connection_in_db(self, db_session, conn: LinkedInConnection, ficha: FichaCandidato):
        if ficha.nome_completo:
            conn.name = fix_utf8(ficha.nome_completo)

        if ficha.headline:
            conn.headline = fix_utf8(ficha.headline)

        conn.about = fix_utf8(ficha.resumo_about)
        conn.experiences = ficha.experiencias
        conn.education = ficha.formacao_academica
        conn.certifications = ficha.licencas_e_certificados
        conn.skills = ficha.competencias
        conn.is_fully_scraped = True
