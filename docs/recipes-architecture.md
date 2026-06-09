# MenuCare - Arquitetura da Base Estruturada de Receitas

## 1. Decisao arquitetural

A Base Estruturada de Receitas e um pilar central do produto.

Sem essa base, os modulos de conformidade, custo e avaliacoes dependem de interpretacao textual repetida.

Com a base estruturada, o sistema passa a operar sobre entidades nutricionais e operacionais consistentes.

## 1.1. Principio de arquitetura

A IA pode apoiar a leitura documental e a classificacao semantica inicial, mas nao deve executar a validacao operacional.

As validacoes de negocio da biblioteca de receitas devem ser deterministicas e auditaveis.

A IA atua em:

- interpretacao de fichas tecnicas
- classificacao semantica
- sugestoes de normalizacao
- recomendacoes futuras

A IA nao atua em:

- aprovar ou reprovar conformidade
- calcular meta financeira
- determinar bloqueio de cardapio
- substituir regra contratual estruturada

## 2. Ordem de modulos (visao alvo)

1. Contratos
2. Regras Contratuais
3. Receitas
4. Cardapios
5. Conformidade
6. Avaliacoes

## 3. Fluxo do modulo de receitas

PDF de Receitas Genial

-> Importacao

-> Leitura de fichas tecnicas

-> Classificacao automatica

-> Base Estruturada de Receitas

-> Validacao deterministica por regras estruturadas

## 4. Campos minimos por receita

- nome
- ingredientes
- modoPreparo
- perCapita
- rendimento
- grupoAlimentar
- valorNutricional
- custo

Observacao:
Campos podem ser nulos quando a ficha nao trouxer a informacao, mas o parser deve registrar a ausencia de forma explicita.

## 5. Modelo de dados recomendado

### 5.1 recipe_library_items

- id
- company_name
- source_file_name
- source_reference
- name
- normalized_name
- category
- subcategory
- food_group
- cost_per_capita
- serving_yield
- preparation_method
- nutritional_info_json
- compatible_diets_json
- allergens_json
- is_active
- created_at
- updated_at

### 5.2 recipe_ingredients

- id
- company_name
- name
- normalized_name
- ingredient_group
- created_at

### 5.3 recipe_item_ingredients

- id
- company_name
- recipe_id
- ingredient_id
- quantity
- unit
- created_at

### 5.4 recipe_import_events

- id
- company_name
- file_name
- imported_count
- classified_count
- warnings_json
- actor_id
- actor_name
- created_at

## 6. Taxonomia inicial de classificacao

Categoria (exemplos):
- Proteina
- Carboidrato
- Legume
- Verdura
- Fruta
- Sobremesa

Subcategoria (exemplos):
- Fruta Citrica
- Fruta Nao Citrica
- Peixe
- Frango
- Bovino
- Suino

Grupo alimentar:
- grupo semantico usado para cruzamento com regra contratual.

Exemplos de mapeamento:
- Laranja -> Fruta / Fruta Citrica
- Ponkan -> Fruta / Fruta Citrica
- Maca -> Fruta / Fruta Nao Citrica
- Salmao com Crosta de Ervas -> Proteina / Peixe

## 7. Regras de operacao

- Classificacao automatica nunca e muda sem rastreabilidade.
- Reclassificacao manual deve gerar evento de auditoria.
- Toda regra contratual por grupo deve priorizar consulta por classificacao estruturada.
- Fallback textual so e usado quando nao houver receita classificada.
- Conformidade, frequencia, meta financeira e bloqueios devem ser calculados por regras estruturadas.

## 8. Impacto por modulo

### Conformidade

Permite validar regra por grupo nutricional em vez de string literal.

Exemplo:
Regra "fruta citrica 3x por semana" passa a contar itens classificados como citricos.

### Financeiro

Permite sugestao explicavel por custo de receita.

Exemplo:
Trocar receita cara por receita equivalente com economia estimada por refeicao.

### Avaliacoes

Permite formar historico por combinacao de receitas normalizadas.

Exemplo:
[Frango Grelhado, Arroz, Feijao] -> nota media, tendencia, volume.

## 9. Entregas incrementais

### Iteracao R1

- persistencia das tabelas base
- endpoint de importacao estruturada de receitas
- endpoint de listagem com filtros por categoria/subcategoria/grupo

### Iteracao R2

- classificador automatico com dicionario inicial
- endpoint de reclassificacao manual auditada

### Iteracao R3

- integracao da auditoria contratual usando receita classificada como fonte primaria
- metricas de cobertura de classificacao por tenant

Status:
- concluida no backend
- exposta no frontend com explicabilidade de evidencia estruturada vs fallback textual

### Iteracao R4

- ampliar sugestoes especificas por grupo alimentar com substituicoes equivalentes mais precisas
- reduzir dependencia de fallback textual em auditoria e sugestoes
- preparar base para regras contratuais por frequencia e recorrencia usando classificacao estruturada

Status:
- concluida no backend para auditoria e sugestoes estruturadas
- concluida no frontend com badges dedicados para frequencia e recorrencia estruturadas
- concluida no contrato da API de sugestoes com `evidenceSubtype` explicito (`frequency`, `recurrence`, `classification` ou `null`)

## 10. Criterios de sucesso

- >= 90% das receitas importadas classificadas automaticamente no tenant piloto.
- regras por grupo nutricional auditadas com explicacao baseada em receita estruturada.
- reducao de ambiguidade em auditorias de cardapio por nome textual.
