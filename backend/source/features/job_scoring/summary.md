# Job Scoring Summary

Resumo baseado no benchmark atual rodado sobre `38` vagas do SQLite local.

## Como cada abordagem funciona

### `rules_scorer`

- Usa listas de termos, bônus e penalidades explícitas.
- Favorece `Python + backend + APIs + Flask/FastAPI/Django/Pytest`.
- Dá bônus separados para banco de dados, cloud/devops e benefícios.
- Penaliza `IA/data` como uso secundário de Python e sinais de `fullstack/frontend`.

**Vantagens**

- Muito explicável.
- Fácil de ajustar.
- Bom para inspeção manual e debugging de ranking.

**Limitações**

- Ainda pode supervalorizar títulos fortes com texto genérico.
- Continua vulnerável a vagas `fullstack` quando Python aparece com destaque.

### `hybrid_scorer`

- Mantém as regras.
- Adiciona normalização, sinônimos canônicos, overlap fuzzy e proximidade contextual.
- Tenta distinguir `Python para backend` de `Python em contexto lateral`.

**Vantagens**

- Melhor cobertura textual que regex puro.
- Top 10 atual parece mais rico em vagas Python reais.

**Limitações**

- Ainda está generoso demais com alguns casos `fullstack`.
- Pode subir vagas de `platform/data` quando o texto técnico se parece com backend.

### `embeddings_scorer`

- Usa embeddings locais leves via hashing determinístico de tokens e bigramas.
- Compara cada vaga com textos-âncora positivos e negativos do perfil.
- Combina score semântico com o `rules_scorer`.

**Vantagens**

- Totalmente local, sem API nem modelo remoto.
- Bom como segundo sinal para reordenar vagas e evitar alguns falsos positivos óbvios.

**Limitações**

- A implementação atual é leve, não equivalente a um embedding pré-treinado.
- Ficou conservadora demais e subpontuou algumas vagas boas.

## Exemplos reais do benchmark atual

### Top 5 `rules_scorer`

1. `83.00` | `Desenvolvedor(a) Python Pleno`
2. `79.80` | `Fullstack Developer (Python, React)`
3. `78.30` | `Senior Backend Developer (Python)`
4. `78.00` | `Python Engineer`
5. `75.30` | `Senior Python Developer`

### Top 5 `hybrid_scorer`

1. `90.55` | `Senior Python Developer`
2. `89.25` | `09a3 DESENVOLVEDOR III`
3. `82.75` | `Junior Data Platform Engineer | English Fluent | Remote`
4. `80.25` | `Python Engineer`
5. `79.50` | `Dev Python Pl`

### Top 5 `embeddings_scorer`

1. `47.68` | `Desenvolvedor(a) Python Pleno`
2. `45.66` | `09a3 DESENVOLVEDOR III`
3. `44.24` | `Desenvolvedor Fusll Stack Python Pleno`
4. `39.57` | `Desenvolvedor Back End - Python | Django`
5. `38.70` | `Dev Python Pl`

### Casos suspeitos que merecem revisão manual

- `Fullstack Developer (Python, React)` continua alto em `rules` e `hybrid`.
- `Junior Data Platform Engineer` subiu demais no `hybrid`.
- `Desenvolvedor Fusll Stack Python Pleno` ainda fica alto em `hybrid` e `embeddings`.

## Qual abordagem parece mais promissora

**Melhor baseline imediato:** `hybrid_scorer`

Motivo:

- hoje ele entrega o ranking mais útil para triagem manual;
- é mais flexível que o `rules_scorer`;
- continua totalmente interpretável e barato de manter.

**Melhor direção de evolução:** `embeddings_scorer` como sinal auxiliar

Motivo:

- a arquitetura já está preparada para trocar o embedding leve por um embedding local mais forte no futuro;
- mesmo agora ele já funciona como contraponto conservador a falsos positivos;
- ele deve melhorar bastante se ganhar âncoras melhores ou um encoder local real.

## Arquivos de saída mais úteis

- `outputs/benchmark_summary.md`
- `outputs/approach_comparison.csv`
- `outputs/rules_scorer_top_10.json`
- `outputs/hybrid_scorer_top_10.json`
- `outputs/embeddings_scorer_top_10.json`
- `outputs/*_suspicious.json`
