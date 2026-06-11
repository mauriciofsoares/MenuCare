# MenuCare - Diretrizes Arquiteturais e Evolucao do Produto

## Contexto
O MenuCare e uma plataforma SaaS de governanca, conformidade e gestao inteligente de cardapios institucionais.

O objetivo principal nao e gerar cardapios automaticamente.

O objetivo principal e transformar contratos, regras operacionais, receitas, avaliacoes e cardapios em decisoes auditaveis e rastreaveis.

Toda evolucao futura deve preservar esse principio.

---

## Principios de Produto

### 1. IA nunca e autoridade
A IA pode:
- Extrair informacoes
- Classificar informacoes
- Sugerir informacoes

A IA nunca pode:
- Aprovar regras
- Publicar cardapios
- Liberar nao conformidades
- Tomar decisoes finais

Toda decisao critica deve possuir aprovacao humana.

### 2. Evidencia e obrigatoria
Toda recomendacao deve possuir:
- Origem
- Motivo
- Regra relacionada
- Evidencia utilizada

Nenhuma funcionalidade deve gerar conclusoes sem rastreabilidade.

### 3. Conformidade e deterministica
Apos aprovadas, regras contratuais devem ser executadas por codigo deterministico.

Exemplo:
- Regra: "Sodio maximo = 2g"
- Execucao: `if (sodio > 2) naoConforme = true`

Nao utilizar LLM para executar regras operacionais.

---

## Principios Arquiteturais

### 4. O dominio define a arquitetura
A arquitetura deve refletir o dominio.

Modulos de negocio:
- Auth
- Contracts
- ContractRules
- Menus
- Recipes
- Evaluations
- Compliance
- NonConformities
- Recommendations
- Governance

Evitar crescimento de arquivos centralizadores.

### 5. Eliminar DDL runtime
Nao criar tabelas durante execucao de endpoints.

Toda alteracao estrutural deve ocorrer via migration versionada.

Objetivos:
- Ambiente reproduzivel
- Auditoria de schema
- Deploy previsivel

### 6. Prisma deve refletir o dominio real
O schema Prisma deve representar todas as entidades operacionais do MenuCare.

Nao manter logica estrutural paralela ao Prisma.

### 7. Separacao por contexto de negocio
Evitar concentracao de responsabilidades.

Estrutura alvo da API:

```text
apps/api/src/modules
  auth/
  contracts/
  rules/
  menus/
  recipes/
  compliance/
  recommendations/
  governance/
```

Cada modulo deve possuir:
- routes
- service
- repository
- schemas

### 8. Handlers HTTP devem ser finos
Rotas devem:
- Validar entrada
- Chamar servico
- Retornar resposta

Regras de negocio nao devem ficar nos handlers.

---

## IA e Processamento de Documentos

### 9. IA deve ser desacoplada
Criar app dedicada para processamento futuro:

```text
apps/ai-worker
```

Responsabilidades:
- OCR
- Processamento de PDF
- Extracao contratual
- Classificacao

Nao executar cargas pesadas dentro da API principal.

### 10. Processamento assincrono
Toda operacao pesada deve suportar:
- Fila
- Retry
- Status
- Auditoria

Fluxo alvo:

```text
Upload -> Job -> Worker -> Resultado
```

---

## Banco de Dados

### 11. Multi-tenant obrigatorio
Toda entidade operacional deve possuir `tenant_id`.

Nunca confiar em `tenant_id` vindo da interface.

Tenant deve ser derivado da identidade autenticada.

### 12. Auditoria por padrao
Entidades criticas devem registrar:
- Quem alterou
- Quando alterou
- O que mudou

---

## Frontend

### 13. Quebrar App principal por dominio
Evitar crescimento do componente principal.

Estrutura alvo:

```text
features/
  contracts/
  compliance/
  recipes/
  recommendations/
  governance/
```

Cada feature deve possuir:
- pages
- components
- hooks
- services

---

## Prioridades para os proximos meses
Ordem obrigatoria:
1. Consolidar dominio e schema
2. Implementar migrations
3. Modularizar backend
4. Modularizar frontend
5. Implementar observabilidade
6. Introduzir filas e worker
7. Introduzir IA contratual
8. Evoluir inteligencia operacional

Nao inverter essa ordem sem justificativa tecnica.

---

## Checklist de decisao arquitetural
Ao propor qualquer mudanca, responder:
1. Preserva rastreabilidade?
2. Preserva auditoria?
3. Preserva multi-tenant?
4. Preserva explicabilidade?
5. Reduz acoplamento?
6. Aproxima arquitetura do dominio?

Se alguma resposta for "nao", reavaliar a implementacao.

---

## Politica de evolucao
O MenuCare deve evoluir como plataforma de governanca e conformidade.

A qualidade futura depende mais de:
- Base estruturada de regras
- Evidencias auditaveis
- Motor deterministico
- Modelo de dominio coerente

Do que de adicionar IA generativa sem governanca.
