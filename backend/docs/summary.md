# Arquitetura do Projeto --- Leitura Qualitativa

## Leitura geral

O projeto é um backend Flask orientado a "features". O bootstrap em
app.py registra blueprints por domínio e inicializa o SQLite via
database/database_connection.py. O centro funcional do sistema hoje
parece ser: capturar/configurar chamadas do LinkedIn, buscar vagas,
enriquecer detalhes, persistir em SQLite e expor isso por HTTP.

------------------------------------------------------------------------

# Camadas compartilhadas

## app.py

Responsabilidade principal: Subir Flask, Swagger, CORS, logging e
registrar os blueprints das features.

Papel arquitetural: Bootstrap HTTP e wiring do sistema. Totalmente
central.

Resumo executivo: É o montador do backend. Não contém regra de negócio
pesada, mas concentra o acoplamento estrutural do projeto.

------------------------------------------------------------------------

## models

Responsabilidade principal: Mapear o domínio persistido em SQLAlchemy.

Resumo executivo: É a base do backend. O modelo Job virou o ponto de
convergência entre scraping, tracking, enrichment e UI.

------------------------------------------------------------------------

## database

Responsabilidade principal: Conexão, sessão e utilitários de banco.

Resumo executivo: Fundação de persistência. SQLAlchemy é o caminho
principal.

------------------------------------------------------------------------

## services

Responsabilidade principal: Hospedar serviços transversais como LLMs,
embeddings e integrações auxiliares.

Resumo executivo: Camada de apoio para IA e integrações externas.

------------------------------------------------------------------------

# source/features

## fetch_curl

Responsabilidade principal: Persistir e executar cURLs autenticados do
LinkedIn.

Resumo executivo: Gateway operacional do LinkedIn.

------------------------------------------------------------------------

## job_population

Responsabilidade principal: Pipeline de ingestão e enriquecimento de
vagas.

Resumo executivo: Pipeline histórico central de ingestão.

------------------------------------------------------------------------

## get_applied_jobs

Responsabilidade principal: Tracking de vagas aplicadas e sincronização
com banco.

Resumo executivo: Feature mais central do produto.

------------------------------------------------------------------------

## enrich_jobs

Responsabilidade principal: Enriquecimento detalhado de vagas.

Resumo executivo: Motor de enrichment.

------------------------------------------------------------------------

## search_jobs

Responsabilidade principal: Busca live de vagas no LinkedIn.

Resumo executivo: Feature limpa para busca em tempo real.

------------------------------------------------------------------------

## jobs

Responsabilidade principal: Repositório SQL de jobs.

Resumo executivo: Extração da camada de persistência.

------------------------------------------------------------------------

## profile

Responsabilidade principal: CRUD de perfil e scraping de experiências.

Resumo executivo: Mistura perfil interno com integração LinkedIn.

------------------------------------------------------------------------

## resume

Responsabilidade principal: CRUD e tailoring de currículo.

Resumo executivo: Suporte ao fluxo de candidatura.

------------------------------------------------------------------------

## gmail_service

Responsabilidade principal: Sincronizar emails com vagas.

Resumo executivo: Conecta comunicação ao funil de candidaturas.

------------------------------------------------------------------------

## friends_connections

Responsabilidade principal: Scraping de conexões LinkedIn.

Resumo executivo: Vertical paralela de dados de rede.

------------------------------------------------------------------------

## api_fetch

Responsabilidade principal: Código legado de exploração de endpoints
LinkedIn.

Resumo executivo: Laboratório histórico.

------------------------------------------------------------------------

## playwright_scrapper

Responsabilidade principal: Ferramentas de sniffing de tráfego.

Resumo executivo: Instrumentação experimental.

------------------------------------------------------------------------

# Visão macro do sistema

Entrada HTTP → controllers → services → integração LinkedIn → enrichment
→ persistência → resposta JSON.

------------------------------------------------------------------------

# Dívidas arquiteturais percebidas

- duplicação de repositórios de Job
- mistura de legacy com código novo
- dependência estrutural forte em fetch_curl
- controllers grandes demais
- mistura de dados runtime com código
- domain Job sobrecarregado

------------------------------------------------------------------------

# Sugestão de reorganização

source/ http/ domains/jobs/ domains/profile/ domains/connections/
integrations/linkedin/ integrations/gmail/ integrations/llm/
persistence/ ops/