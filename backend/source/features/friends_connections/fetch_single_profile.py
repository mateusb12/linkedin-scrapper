# backend/source/features/friends_connections/fetch_single_profile.py

import json
import os
import time
import random
from dataclasses import asdict

from database.database_connection import get_db_session
from models.connection_models import LinkedInConnection
from source.features.fetch_curl.fetch_service import FetchService
from source.features.playwright_scrapper.analyze_profile import analyze_mega_file, FichaCandidato


class ProfileEnrichmentService:
    def __init__(self, debug=True):
        self.debug = debug

    def enrich_pending_profiles(self, limit=20):
        """Busca no banco conexões pendentes e enriquece com Backoff Suave (Jitter)."""
        db = get_db_session()
        try:
            # Puxa até X perfis para não estourar o timeout do navegador
            pending_connections = db.query(LinkedInConnection).filter_by(is_fully_scraped=False).limit(limit).all()

            if not pending_connections:
                return 0

            enriched_count = 0
            total = len(pending_connections)

            for idx, conn in enumerate(pending_connections):
                if self.debug:
                    print(f"\n⚡ [{idx + 1}/{total}] Iniciando Enrichment para: {conn.vanity_name}")

                raw_data = self._fetch_raw_profile_data(conn.vanity_name)

                if raw_data:
                    ficha = self._analyze_raw_data(conn.vanity_name, raw_data)
                    if ficha:
                        self._update_connection_in_db(db, conn, ficha)
                        enriched_count += 1
                else:
                    print(f"❌ Falha ao buscar dados brutos para {conn.vanity_name}. Pulando...")

                # --- 🛑 JITTER BACKOFF ENTRE PERFIS ---
                # Não pausa depois do último perfil do batch
                if idx < total - 1:
                    delay = random.uniform(3.5, 6.5)
                    if self.debug:
                        print(f"⏳ Jitter: Pausando {delay:.1f}s para evitar rate-limit...")
                    time.sleep(delay)

            db.commit()
            return enriched_count

        except Exception as e:
            db.rollback()
            print(f"❌ Erro crítico no Enrichment Loop: {str(e)}")
            raise e
        finally:
            db.close()

    def _fetch_raw_profile_data(self, vanity_name: str) -> dict:
        """Faz as chamadas HTTP para os 3 endpoints vitais do perfil com pausas internas."""
        raw_data = {}

        configs_to_fetch = [
            "ProfileMain",
            "ProfileAboveActivity",
            "ProfileBelowActivity"
        ]

        for i, config in enumerate(configs_to_fetch):
            if self.debug: print(f"  ↳ Puxando {config}...")
            response = FetchService.execute_dynamic_profile_fetch(config_name=config, target_vanity_name=vanity_name)

            if response:
                raw_data[config] = response
            else:
                print(f"  ⚠️ Aviso: Nenhuma resposta útil para {config}")

            # --- 🛑 JITTER BACKOFF INTERNO (Entre requests do mesmo perfil) ---
            if i < len(configs_to_fetch) - 1:
                time.sleep(random.uniform(1.0, 2.0))

        if not raw_data.get("ProfileMain") and not raw_data.get("ProfileBelowActivity"):
            return None

        return raw_data

    def _analyze_raw_data(self, vanity_name: str, raw_data: dict) -> FichaCandidato:
        """Adaptação do analyze_mega_file para usar arquivo temporário mockando a leitura de disco."""
        temp_file = f"temp_raw_{vanity_name}.json"

        with open(temp_file, 'w', encoding='utf-8') as f:
            json.dump(raw_data, f)

        try:
            ficha = analyze_mega_file(vanity_name, temp_file)
            if os.path.exists(temp_file):
                os.remove(temp_file)
            return ficha
        except Exception as e:
            print(f"❌ Falha no analyze_mega_file: {str(e)}")
            if os.path.exists(temp_file):
                os.remove(temp_file)
            return None

    def _update_connection_in_db(self, db_session, conn: LinkedInConnection, ficha: FichaCandidato):
        """Atualiza a linha do banco com os dados ricos."""
        if ficha.nome_completo: conn.name = ficha.nome_completo
        if ficha.headline: conn.headline = ficha.headline

        conn.about = ficha.resumo_about
        conn.experiences = ficha.experiencias
        conn.education = ficha.formacao_academica
        conn.certifications = ficha.licencas_e_certificados
        conn.skills = ficha.competencias

        conn.is_fully_scraped = True

        if self.debug: print(f"✅ Ficha salva no banco para {conn.name}!")
