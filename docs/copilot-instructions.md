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

MenuCare é uma plataforma SaaS de gestão contratual, conformidade e geração de cardápios.

O sistema permite que empresas de alimentação, hospitais e nutricionistas transformem contratos e documentos regulatórios em uma base estruturada de regras validadas.

O objetivo principal é garantir conformidade contratual.

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
