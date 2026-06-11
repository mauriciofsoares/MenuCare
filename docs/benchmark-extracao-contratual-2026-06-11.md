# Benchmark de Extracao Contratual (Ollama)

Data: 2026-06-11
Escopo: validacao ponta a ponta da extracao de regras com chunking por segmentos
Contrato usado: docs/CONTRATO RFP FOOD 2024 ONESUBSEA BRASIL.pdf
Ambiente: API Docker em http://localhost:3001, modelo qwen2.5:7b

## Objetivo
- Validar se o chunking elimina timeouts no fluxo real de extracao contratual.
- Medir telemetria por segmento para identificar faixa de tamanho mais eficiente no modelo atual.
- Medir cobertura de evidencia contratual por regra (com e sem `sourceExcerpt`).

## Metodo
1. Login real em /auth/login e selecao do contrato mais recente em /contracts?limit=1.
2. Execucao de 3 rodadas E2E de POST /contracts/{id}/extract-rules com upload do PDF real.
3. Coleta dos eventos `contract-rule-extraction-diagnostic` em `ai_preparation_events`.
4. Consolidacao de metricas por execucao e por chunk.
5. Na Sprint P, leitura do diagnostico mais recente com `rulesWithEvidence` e `rulesWithoutEvidence`.
6. Consolidacao de cobertura no banco em `extracted_rules.source_excerpt`.

## Resultado E2E (HTTP)
- Rodada 1: HTTP 200, TOTAL_TIME 24.804s, resposta `status=ok`, `count=0`.
- Rodada 2: HTTP 200, TOTAL_TIME 17.823s, resposta `status=ok`, `count=0`.
- Rodada 3: HTTP 200, TOTAL_TIME 17.885s, resposta `status=ok`, `count=0`.

Observacao: nao houve HTTP 504 nas 3 rodadas do benchmark.

## Resumo dos 3 eventos mais recentes (telemetria)
- outcome: `empty` em todas as 3 execucoes
- segmentation.strategy: `pages`
- totalSegments: 2
- averageSegmentChars: 5706
- rulesDetected: 0
- responseLength: 300

## Metricas por segmento (3 execucoes x 2 chunks)
Chunks observados por execucao:
- Chunk 1: chunkSize=5999
- Chunk 2: chunkSize=5412

Consolidado por tamanho:
- chunkSize 5412
  - amostras: 3
  - avg duration: 8240.67 ms
  - min: 8157 ms
  - max: 8288 ms
  - erros: 0
  - timeouts: 0
- chunkSize 5999
  - amostras: 3
  - avg duration: 11339.33 ms
  - min: 8951 ms
  - max: 15953 ms
  - erros: 0
  - timeouts: 0

## Comparativo historico curto (ultimos 7 eventos)
- Ultimos 5 eventos: sem timeout, outcome `empty`, strategy `pages`, totalSegments=2.
- Dois eventos anteriores ao ajuste: `error` com mensagem `Timeout apos 110s`.

Interpretacao: no historico daquele recorte de benchmark, o timeout de 110s deixou de ocorrer nas execucoes avaliadas.

## Sprint P - Evidencia contratual

Alteracoes aplicadas:
- Inclusao de `source_excerpt` em `extracted_rules`.
- Prompt de extracao atualizado para exigir `sourceExcerpt`.
- Parser de normalizacao atualizado para aceitar apenas regras com `sourceExcerpt` valido.
- Diagnostico atualizado com `rulesWithEvidence` e `rulesWithoutEvidence`.

## Sprint P v2 - Duas etapas (desempenho + rastreabilidade)

Estratégia aplicada:
- Etapa 1: extração principal voltou a exigir apenas `title`, `description` e `category`.
- Etapa 2: enriquecimento de evidência após a extração, com prioridade determinística e fallback de IA opcional (`OLLAMA_EVIDENCE_FALLBACK_ENABLED=true`).

Campos persistidos para rastreabilidade:
- `source_excerpt`
- `source_page`
- `evidence_confidence`

Resultado E2E mais recente com contrato real:
- HTTP 200
- TOTAL_TIME: 79.95s
- payload: `status=ok`, `count=0`

Diagnóstico do último evento:
- outcome: `empty`
- strategy: `pages`
- totalSegments: 2
- rulesDetected: 0
- rulesWithEvidence: 0
- rulesWithoutEvidence: 0
- errorMessage: vazio

Cobertura em `extracted_rules` após o teste:
- total_regras: 0
- regras_com_evidencia: 0
- regras_sem_evidencia: 0
- regras_com_pagina: 0
- regras_com_confianca: 0

Ultima execucao E2E apos Sprint P (mesmo contrato real):
- outcome: `error`
- strategy: `pages`
- totalSegments: 2
- errorMessage: `Timeout em todos os 2 segmentos`
- rulesDetected: 0
- rulesWithEvidence: 0
- rulesWithoutEvidence: 0

Consolidado em `extracted_rules` apos a rodada:
- total_regras: 0
- regras_com_evidencia: 0
- regras_sem_evidencia: 0

## Conclusao
- No benchmark inicial, o chunking reduziu/evitou timeout em 3 rodadas consecutivas.
- Na rodada Sprint P (com exigencia de `sourceExcerpt`), houve regressao de latencia com timeout em todos os segmentos.
- As metricas de evidencia estao implementadas e prontas para auditoria, mas ainda sem regras persistidas porque a rodada terminou em timeout.
- Para o modelo atual (qwen2.5:7b), o tamanho de segmento em torno de 5.4k caracteres segue mais eficiente que ~6.0k no cenario sem a exigencia de evidencia.
- Na Sprint P v2 (duas etapas), o fluxo voltou a responder sem timeout HTTP no teste real mais recente.

## Recomendacao de tuning
- Faixa inicial recomendada: 5200 a 5600 caracteres por segmento (baseado no melhor ponto observado em 5412 chars).
- Evitar subir para ~6000+ sem necessidade, pois houve piora de latencia e maior variancia.
- Proxima rodada de benchmark sugerida: testar 4200, 4800 e 5400 chars (>=5 rodadas por configuracao), mantendo `sourceExcerpt` obrigatorio.
- Reduzir `num_predict` para extração com evidencia e comparar impacto em timeout por segmento.

## Limitacoes
- O benchmark inicial confirmou comportamento de desempenho, mas sem regras extraidas.
- A rodada Sprint P confirmou instrumentacao de evidencia, porem com timeout e sem amostra de regras persistidas.
- Ainda e necessario calibrar prompt/modelo para extrair regras com evidencia sem degradar tempo de resposta.
- O cenário atual continua sem regras extraidas (`count=0`), portanto a cobertura de evidência permanece zerada por ausência de amostra funcional de regras.
