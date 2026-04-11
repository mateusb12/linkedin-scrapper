# Job Scoring

Feature local para ranquear vagas do SQLite com três abordagens:

- `rules_scorer`: regras explícitas, pesos e penalidades.
- `hybrid_scorer`: regras + normalização + sinônimos + fuzzy/contexto.
- `embeddings_scorer`: embeddings locais por hashing + regras explícitas.

## Estrutura

- `config/`: pesos, preferências e âncoras semânticas.
- `repository/`: leitura isolada do SQLite.
- `scorers/`: interface comum e implementações.
- `evaluation/`: benchmark, comparação e export.
- `scripts/`: entrypoints executáveis.
- `outputs/`: artefatos gerados.

## Como executar

Dentro do container `linkedin-backend-dev`:

```bash
docker exec linkedin-backend-dev python -m source.features.job_scoring.scripts.run_rules_scorer
docker exec linkedin-backend-dev python -m source.features.job_scoring.scripts.run_hybrid_scorer
docker exec linkedin-backend-dev python -m source.features.job_scoring.scripts.run_embeddings_scorer
docker exec linkedin-backend-dev python -m source.features.job_scoring.scripts.run_benchmark
docker exec linkedin-backend-dev python -m source.features.job_scoring.scripts.compare_approaches
docker exec linkedin-backend-dev python -m source.features.job_scoring.scripts.export_top_results --scorer embeddings --top-k 10
```

Opções úteis:

```bash
docker exec linkedin-backend-dev python -m source.features.job_scoring.scripts.run_benchmark --limit 20
docker exec linkedin-backend-dev python -m source.features.job_scoring.scripts.run_benchmark --output-dir /app/source/features/job_scoring/outputs
```

## Como cada abordagem funciona

### `rules_scorer`

- Usa match explícito em `title`, `description_full`, `description_snippet`, `qualifications`, `keywords`, `programming_languages`, `premium_title` e `premium_description`.
- Dá mais peso para Python central no backend.
- Penaliza vagas com Python periférico em IA/data e vagas com stack principal fora do alvo.
- Retorna subscore por categoria e explicabilidade textual.

### `hybrid_scorer`

- Mantém a base de regras.
- Adiciona normalização, sinônimos canônicos, overlap fuzzy e proximidade contextual.
- Distingue melhor frases equivalentes e reduz dependência de match literal.

### `embeddings_scorer`

- Gera vetores locais via hashing determinístico de tokens e bigramas.
- Compara a vaga com textos âncora positivos e negativos do perfil.
- Combina score semântico local com o `rules_scorer`.
- Não usa API externa nem modelo remoto.

## Artefatos gerados

- `rules_scorer.json` / `.csv`
- `hybrid_scorer.json` / `.csv`
- `embeddings_scorer.json` / `.csv`
- `*_top_10.json`
- `*_bottom_10.json`
- `*_suspicious.json`
- `approach_comparison.csv`
- `benchmark_summary.md`

## Limitações atuais

- O scorer semântico é leve e local; não substitui embeddings pré-treinados.
- O corpus atual está pequeno, então os pesos ainda dependem de inspeção manual.
- Benefícios raramente aparecem em detalhe nas vagas do banco atual.

