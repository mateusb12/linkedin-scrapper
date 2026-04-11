# Job Scoring

Feature pronta para uso no backend, com `hybrid_scorer` como caminho oficial.

O fluxo público da feature é:

`input HTTP -> request schema -> JobScoringService -> HybridScorer -> response explicável`

`rules_scorer`, `embeddings_scorer`, benchmark e scripts comparativos continuam no repositório apenas como artefatos internos/experimentais. Eles não fazem parte da API pública.

## Estrutura

- `job_scoring_router.py`: rotas Flask e Swagger.
- `job_scoring_controller.py`: camada HTTP fina, parsing e tratamento de erro.
- `schemas.py`: validação de payload.
- `mappers.py`: adaptação request/domain/response.
- `job_scoring_service.py`: fachada de aplicação da feature.
- `scorers/hybrid_scorer.py`: motor oficial de scoring.
- `source/features/jobs/job_repository.py`: fonte oficial de acesso a `jobs` para o endpoint de ranking local.
- `evaluation/`, `scripts/`, `outputs/`: legado de benchmark e experimentação.

## Endpoints oficiais

Base path: `/job-scoring`

### `POST /job-scoring/score`

Avalia uma vaga individual.

Exemplo:

```json
{
  "id": "job-1",
  "title": "Senior Backend Engineer (Python)",
  "description_full": "Build backend APIs in Python with FastAPI, PostgreSQL, Docker and AWS.",
  "qualifications": ["Python", "FastAPI", "PostgreSQL", "Docker"]
}
```

Resposta:

```json
{
  "status": "success",
  "data": {
    "id": "job-1",
    "external_id": null,
    "urn": "job-1",
    "title": "Senior Backend Engineer (Python)",
    "total_score": 79.0,
    "category_scores": {
      "python_primary": 52.0,
      "databases": 10.0,
      "cloud_devops": 11.0,
      "benefits": 0.0,
      "penalties": 0.0
    },
    "archetype": "backend_python_pure",
    "matched_keywords": {
      "python_primary": ["python", "fastapi"],
      "databases": ["postgresql"],
      "cloud_devops": ["docker", "aws"],
      "benefits": [],
      "penalties": []
    },
    "bonus_reasons": ["Python aparece junto de framework/testes do stack desejado."],
    "penalty_reasons": [],
    "evidence": ["Build backend APIs in Python with FastAPI, PostgreSQL, Docker and AWS."],
    "suspicious": false,
    "suspicious_reasons": [],
    "metadata": {
      "archetype": "backend_python_pure"
    }
  }
}
```

### `POST /job-scoring/rank`

Recebe uma lista de vagas, aplica o `hybrid_scorer`, ordena do maior para o menor e preserva `id`/`external_id`.

```json
{
  "items": [
    {
      "id": "job-1",
      "title": "Senior Backend Engineer (Python)",
      "description_full": "Build backend APIs in Python with FastAPI, PostgreSQL, Docker and AWS."
    },
    {
      "id": "job-2",
      "title": "Frontend Engineer",
      "description_full": "Own React and TypeScript interfaces."
    }
  ]
}
```

### `POST /job-scoring/rank-descriptions`

Atalho para payloads com apenas `title` e `description`.

### `POST /job-scoring/rank-db`

Secundário. Lê vagas do SQLite local, aplica o `hybrid_scorer` e permite filtros:

- `has_applied`
- `work_remote_allowed`
- `company_urn`
- `application_status`
- `limit`

## Como testar

Dentro do container `linkedin-backend-dev`:

```bash
docker exec linkedin-backend-dev pytest tests/test_job_scoring_feature.py tests/test_job_scoring_service.py tests/test_job_scoring_api.py
```

Exemplo com `curl`:

```bash
curl -X POST http://localhost:5000/job-scoring/score \
  -H 'Content-Type: application/json' \
  -d '{
    "title": "Senior Backend Engineer (Python)",
    "description_full": "Build backend APIs in Python with FastAPI, PostgreSQL, Docker and AWS."
  }'
```

## Observações

- O scorer oficial da API é sempre `hybrid_scorer`.
- A resposta é auditável: score total, subscores, archetype, evidências, bônus, penalidades e `suspicious_reasons`.
- Benchmarks e scorers alternativos não devem ser tratados como fluxo principal do produto.
