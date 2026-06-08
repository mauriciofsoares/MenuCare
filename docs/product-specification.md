# MENUCARE - CONTEXTO OFICIAL DO PRODUTO

## Visão Geral

O MenuCare é uma plataforma SaaS de gestão contratual, conformidade e geração de cardápios para serviços de alimentação.

O objetivo principal do sistema é transformar contratos, editais, termos de referência, procedimentos operacionais e documentos regulatórios em uma base estruturada de regras de negócio que servirá como fundamento para a criação e validação de cardápios.

A plataforma deve transmitir confiança, governança, rastreabilidade e conformidade.

A inteligência artificial é apenas um mecanismo interno de apoio ao processamento documental e não deve ser o foco da experiência do usuário.

O sistema não deve utilizar textos como:

* "A IA gerou seu cardápio"
* "A IA analisou o contrato"
* "Resultado da IA"

Em vez disso utilizar:

* Regras identificadas
* Regras extraídas
* Base contratual
* Requisitos contratuais
* Conformidade
* Regras aprovadas
* Regras validadas
* Motor de conformidade
* Padronização contratual

---

# Fluxo Principal do Produto

## Etapa 1 - Cadastro de Contrato

O usuário realiza upload de:

* Contratos
* Editais
* Licitações
* Termos de referência
* Procedimentos
* Manuais
* Regulamentos
* POPs

Após o envio, o documento entra em processamento.

---

## Etapa 2 - Extração de Regras

O sistema identifica possíveis regras presentes no documento.

Exemplos:

* Quantidade de refeições diárias
* Frequência de frutas
* Restrições alimentares
* Horários obrigatórios
* Frequência de proteínas
* Exigências nutricionais
* Requisitos regulatórios

As regras identificadas nunca entram em produção automaticamente.

---

## Etapa 3 - Validação Humana

Toda regra identificada deve passar por aprovação humana.

O usuário pode:

* Aprovar
* Editar
* Rejeitar

Somente regras aprovadas poderão ser utilizadas posteriormente.

Status possíveis:

* Identificada
* Em Validação
* Aprovada
* Rejeitada
* Arquivada

A validação humana é obrigatória.

Nenhuma regra aprovada pode ser alterada sem rastreabilidade.

---

## Etapa 4 - Base Contratual

Após aprovação, as regras passam a compor a Base Contratual do cliente.

A Base Contratual representa a fonte oficial de requisitos utilizados pelo sistema.

Cada cliente possui sua própria base contratual.

A base contratual é o principal ativo do sistema.

---

## Etapa 5 - Geração de Cardápios

Ao solicitar um novo cardápio, o sistema utiliza:

* Regras aprovadas
* Base contratual
* Fichas técnicas
* Cadastro de preparações
* Restrições alimentares
* Calendário
* Regras nutricionais

O resultado é um cardápio aderente aos requisitos previamente aprovados.

---

## Etapa 6 - Conformidade

Todo cardápio deve passar por uma análise de conformidade.

O sistema deve validar:

* Regras atendidas
* Regras parcialmente atendidas
* Regras não atendidas

Exemplo:

Conformidade Geral: 98%

✓ 6 refeições diárias

✓ Proteína obrigatória no jantar

✓ Frutas cítricas 3x por semana

✗ Repetição de peixe antes do prazo mínimo

---

# Conceitos de Negócio

## Contrato

Documento enviado pelo cliente contendo regras e exigências.

---

## Regra Contratual

Representa um requisito extraído e validado.

Exemplos:

* 6 refeições por dia
* Fruta cítrica 3 vezes por semana
* Proteína obrigatória no jantar

---

## Base Contratual

Conjunto de regras aprovadas.

Representa a verdade oficial utilizada pelo sistema.

---

## Cardápio

Planejamento alimentar gerado a partir da Base Contratual.

---

## Conformidade

Indicador que mede aderência do cardápio às regras aprovadas.

---

# Estrutura de Menus

Dashboard

Contratos

Regras Contratuais

Cardápios

Conformidade

Análises

Tarefas

Integrações

Notificações

Configurações

---

# Dashboard

Indicadores principais:

* Contratos cadastrados
* Regras aprovadas
* Cardápios gerados
* Taxa média de conformidade
* Horas economizadas

Também apresentar:

* Contratos recentes
* Regras pendentes de validação
* Cardápios recentes
* Alertas de conformidade

---

# Módulo Contratos

Funcionalidades:

* Upload
* Versionamento
* Histórico
* Visualização
* Download
* Status de processamento

---

# Módulo Regras Contratuais

É o módulo mais importante da plataforma.

Permite:

* Visualizar regras identificadas
* Aprovar regras
* Editar regras
* Rejeitar regras
* Categorizar regras
* Pesquisar regras
* Histórico de alterações

Categorias:

* Refeições
* Horários
* Dietas
* Frutas
* Proteínas
* Restrições
* Nutrição
* Regulatório
* Outros

---

# Módulo Cardápios

Funcionalidades:

* Gerar cardápio
* Consultar cardápio
* Versionar cardápio
* Exportar PDF
* Exportar Excel

---

# Módulo Conformidade

Permite comparar cardápios contra regras aprovadas.

Exibir:

* Percentual de conformidade
* Não conformidades
* Justificativas
* Histórico de validações

---

# Multi-Tenant

O sistema deve ser preparado desde o início para múltiplos clientes.

Todas as entidades devem possuir:

tenantId

Cada cliente possui:

* Contratos próprios
* Regras próprias
* Cardápios próprios
* Usuários próprios
* Configurações próprias

---

# Auditoria

Todas as ações devem possuir rastreabilidade.

Registrar:

* Usuário
* Data
* Hora
* Operação
* Valor anterior
* Valor novo

Exemplos:

* Regra aprovada
* Regra editada
* Regra rejeitada
* Cardápio gerado
* Contrato enviado

---

# Diretrizes Técnicas

Utilizar:

* React
* TypeScript
* Vite
* Material UI
* React Query
* Axios
* React Router
* Zod
* React Hook Form
* Recharts
* Framer Motion

Arquitetura:

* Clean Architecture
* SOLID
* Componentização máxima
* Feature Based Structure
* Código preparado para SaaS Enterprise

Nunca utilizar qualquer texto que exponha diretamente o uso de inteligência artificial ao usuário final.

A plataforma deve transmitir segurança, governança, conformidade, rastreabilidade e controle operacional.
