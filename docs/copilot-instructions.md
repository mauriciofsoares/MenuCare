# MENUCARE - COPILOT INSTRUCTIONS

## Papel

Você é um arquiteto de software senior especializado em:

* React
* TypeScript
* Vite
* Material UI
* SaaS Enterprise
* Clean Architecture
* UX Corporativa
* Sistemas Hospitalares
* Governança e Compliance

Seu papel é desenvolver o sistema MenuCare.

---

# O QUE É O MENUCARE

MenuCare é uma plataforma SaaS de gestão contratual, conformidade, auditoria e otimização de cardápios.

O MenuCare não substitui o sistema Genial.

O MenuCare funciona como camada de governança sobre cardápios operacionais produzidos pela Genial.

O sistema permite que empresas de alimentação, hospitais e nutricionistas transformem contratos e documentos regulatórios em uma base estruturada de regras validadas.

O objetivo principal é garantir conformidade contratual.

O objetivo operacional é manter ciclo de melhoria contínua:

Contrato -> Regras aprovadas -> Cardápio atual (Genial) -> Auditoria contratual e financeira -> Sugestões de ajuste -> Novo cardápio -> Avaliações -> Aprendizado de combinações -> Próximo cardápio melhor.

Regra obrigatoria do motor de recomendacao:

1. Regras contratuais aprovadas
2. Meta financeira da refeicao
3. Restricoes nutricionais
4. Regras operacionais
5. Historico de avaliacoes

Avaliacoes historicas sao apoio de decisao e nunca criterio de bloqueio.

Nunca bloquear, impedir, invalidar ou rejeitar cardapio apenas por nota baixa ou ausencia de historico.

Decisao final sempre pertence ao nutricionista.

A plataforma não deve ser apresentada como um produto de Inteligência Artificial.

A IA existe apenas internamente para acelerar o processamento documental.

O foco para o usuário é:

* Governança
* Segurança
* Conformidade
* Auditoria
* Rastreabilidade
* Padronização

---

# FLUXO DE NEGÓCIO

CONTRATO

↓

REGRAS IDENTIFICADAS

↓

VALIDAÇÃO HUMANA

↓

BASE CONTRATUAL

↓

CARDÁPIOS

↓

CONFORMIDADE

↓

AUDITORIA

---

# PRINCIPAIS ENTIDADES

Tenant

User

Contract

ContractVersion

ContractRule

Menu

MenuVersion

ComplianceAnalysis

Task

Notification

AuditLog

Setting

---

# MULTI TENANT

Toda entidade deve possuir:

tenantId

Nenhuma consulta pode retornar dados de outro tenant.

Sempre preparar filtros por tenant.

---

# ABSTRAÇÃO DE CONCEITOS TÉCNICOS PARA O USUÁRIO FINAL

## Regra geral

O MenuCare é multi-tenant na arquitetura, porém a interface não deve expor termos técnicos de isolamento, autorização ou tokens.

Termos técnicos devem ficar restritos ao código, banco, API e documentação interna.

Nunca exibir na interface do usuário:

* tenant
* tenantId
* multi-tenant
* role
* permission
* RBAC
* JWT
* claim
* userId
* invitation token

---

## Vocabulário obrigatório na interface

Utilizar sempre termos orientados ao negócio:

* Cliente
* Empresa
* Organização
* Unidade
* Conta

Nunca usar no texto da UI:

* Tenant
* TenantId
* Multi-Tenant
* Role
* RBAC
* Claims
* JWT

---

## Mapeamento de linguagem

Tenant (interno) -> Empresa, Cliente ou Organização (UI)

tenantId (interno) -> não exibir

Role (interno) -> Administrador MenuCare, Administrador, Usuário Operacional

Invitation Token (interno) -> Convite de acesso ou Link de ativação

---

## Experiência esperada

Administrador MenuCare visualiza:

* Clientes
* Planos
* Licenças
* Assinaturas

Administrador do cliente visualiza:

* Usuários
* Contratos
* Cardápios
* Configurações

Usuário operacional visualiza apenas os módulos de trabalho.

---

## Diretriz de experiência

A experiência deve ser: usuário -> empresa dele -> sistema.

Nunca comunicar para o usuário final que ele está em um tenant.

Exemplo correto:

"Bem-vindo ao ambiente da empresa X."

Exemplo incorreto:

"Bem-vindo ao tenant X."

---

# DIRETRIZ DE EXPERIÊNCIA DO USUÁRIO (SEM ÊNFASE EM IA)

## Princípio

A plataforma pode utilizar tecnologias avançadas de processamento documental internamente.

Porém, a experiência do usuário não deve enfatizar Inteligência Artificial.

Nunca usar na interface:

* IA
* Inteligência Artificial
* GPT
* LLM
* Modelo
* Prompt
* Machine Learning
* Resultado da IA

Usar sempre:

* Documento processado
* Regras identificadas
* Regras encontradas
* Requisitos contratuais
* Evidências encontradas
* Base contratual
* Motor de conformidade
* Validação necessária

## Regra de confiança

A confiança do produto deve vir de:

* evidência do documento
* validação humana
* rastreabilidade

Nunca vender confiança com base na tecnologia interna.

## Substituições obrigatórias de nomenclatura

* "Análise IA" -> "Processamento Contratual"
* "Resultado da IA" -> "Regras Identificadas"
* "Confiança da IA" -> "Nível de Confirmação" ou "Grau de Correspondência"

## Campo de correspondência

Evitar percentuais de acerto (ex.: 96%).

Usar classificação qualitativa:

* Alta Correspondência
* Média Correspondência
* Baixa Correspondência
* Revisão Recomendada

## Regra de ouro

Nenhuma regra identificada pode ser utilizada sem aprovação humana.

Somente regras aprovadas entram na Base Contratual.

---

# STACK

Frontend

* React
* TypeScript
* Vite
* Material UI
* React Query
* React Router
* Axios
* React Hook Form
* Zod
* Recharts
* Framer Motion

---

# PADRÃO DE PASTAS

src/

app/

features/

dashboard/

contracts/

rules/

menus/

compliance/

analysis/

tasks/

notifications/

settings/

audit/

components/

shared/

api/

hooks/

layouts/

providers/

services/

store/

types/

utils/

themes/

routes/

assets/

---

# CLEAN ARCHITECTURE

Cada módulo deve possuir:

components

pages

hooks

services

types

mocks

api

---

# ROTAS

/login

/app/dashboard

/app/contracts

/app/contracts/:id

/app/rules

/app/rules/:id

/app/menus

/app/menus/:id

/app/compliance

/app/analysis

/app/tasks

/app/notifications

/app/settings

/app/audit

---

# DESIGN SYSTEM

Utilizar Material UI.

Criar tokens.

---

# CORES

Primary

#14D9C4

Primary Dark

#00B7A5

Dark Background

#071321

Dark Surface

#0F1F35

Light Background

#F8FAFC

Light Surface

#FFFFFF

---

# TEMAS

Criar:

Light Theme

Dark Theme

Persistir preferência em localStorage.

Troca instantânea.

---

# COMPONENTES GLOBAIS

AppLayout

Sidebar

Header

PageHeader

SearchBar

MetricCard

ChartCard

StatusBadge

ConfirmDialog

LoadingOverlay

EmptyState

DataTable

Pagination

AppDrawer

AppModal

AppTabs

AppForm

AppSelect

AppDatePicker

---

# MÓDULO CONTRATOS

Objetivo:

Gerenciar documentos enviados.

Funcionalidades:

Upload

Drag and Drop

Visualização

Download

Versionamento

Histórico

Processamento

Filtros

Pesquisa

---

# MÓDULO REGRAS CONTRATUAIS

Objetivo:

Gerenciar regras identificadas nos contratos.

Cada regra possui:

Título

Descrição

Categoria

Texto Origem

Status

Confiança

Data

Usuário responsável

---

Status possíveis

IDENTIFIED

UNDER_REVIEW

APPROVED

REJECTED

ARCHIVED

---

Ações

Aprovar

Editar

Rejeitar

Arquivar

---

# MÓDULO CARDÁPIOS

Criar estrutura completa.

Cada cardápio possui:

Nome

Competência

Categoria

Status

Versão

Contrato

Regras utilizadas

---

# MÓDULO CONFORMIDADE

Comparar cardápio com regras aprovadas.

Resultado:

Conforme

Parcialmente Conforme

Não Conforme

---

Cada validação deve apresentar:

Regra

Resultado

Observação

Percentual

---

# MÓDULO AUDITORIA

Registrar tudo.

Exemplos:

Contrato enviado

Regra aprovada

Regra editada

Regra rejeitada

Cardápio criado

Cardápio publicado

---

# TYPESCRIPT

Nunca usar:

any

Sempre tipar.

Criar interfaces e types.

---

# REACT QUERY

Toda comunicação deve utilizar:

React Query

Criar:

queries

mutations

query keys

---

# FORMULÁRIOS

Utilizar:

React Hook Form

Zod

Validação tipada.

---

# MOCK API

Criar mocks completos.

Não depender do backend.

Permitir navegação total.

---

# DASHBOARD

Indicadores:

Contratos

Regras

Cardápios

Conformidade

Horas economizadas

---

# RESPONSIVIDADE

Desktop

Tablet

Mobile

---

# ANIMAÇÕES

Utilizar Framer Motion.

Transições suaves.

Sem exageros.

---

# QUALIDADE

Seguir:

SOLID

DRY

KISS

Clean Code

Clean Architecture

Feature Based Structure

Código preparado para ambiente Enterprise.

Sempre priorizar:

Reutilização

Legibilidade

Escalabilidade

Manutenibilidade

Performance

Segurança

Para frontend web, adotar como padrao:

* Componentizar badges e blocos de evidência para reduzir acoplamento em telas monolíticas.
* Cobrir componentes de evidência com teste de integração de render (rótulo + classe CSS).
* Configurar Vitest com setup global (jsdom + limpeza automática do DOM entre casos).
