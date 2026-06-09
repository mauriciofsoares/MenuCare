# MENUCARE - CONTEXTO OFICIAL DO PRODUTO

## Visão Geral

O MenuCare é uma plataforma SaaS de gestão contratual, conformidade, auditoria e otimização de cardápios para serviços de alimentação.

O MenuCare não substitui o sistema Genial.

O MenuCare opera como uma camada de governança sobre os cardápios produzidos pela Genial.

O objetivo principal do sistema é transformar contratos, editais, termos de referência, procedimentos operacionais e documentos regulatórios em uma base estruturada de regras de negócio que servirá como fundamento para a criação e validação de cardápios.

A plataforma deve transmitir confiança, governança, rastreabilidade e conformidade.

A inteligência artificial é apenas um mecanismo interno de apoio ao processamento documental e não deve ser o foco da experiência do usuário.

O sistema não deve utilizar textos como:

* "A IA gerou seu cardápio"
* "A IA analisou o contrato"
* "Resultado da IA"

Em vez disso utilizar:

* Regras identificadas
* Regras encontradas
* Base contratual
* Requisitos contratuais
* Conformidade
* Regras aprovadas
* Regras validadas
* Motor de conformidade
* Padronização contratual
* Evidências encontradas

---

# Fluxo Principal do Produto

## Ciclo estratégico de melhoria contínua

Contrato -> Regras aprovadas -> Cardápio atual (Genial) -> Auditoria contratual -> Sugestões de ajuste -> Novo cardápio -> Avaliação dos pacientes/clientes -> Aprendizado das combinações -> Próximo cardápio melhor

---

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

## Etapa 2 - Identificação de Regras

O sistema identifica possíveis regras presentes no documento e apresenta evidências para validação.

Exemplos:

* Quantidade de refeições diárias
* Frequência de frutas
* Restrições alimentares
* Horários obrigatórios
* Frequência de proteínas
* Exigências nutricionais
* Requisitos regulatórios

As regras identificadas nunca entram em produção automaticamente.

A confiança operacional deve vir de evidência + validação humana + rastreabilidade.

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

## Etapa 5 - Importação de Cardápio Operacional (Genial)

O sistema importa o cardápio operacional produzido na Genial, incluindo estrutura de serviços, receitas e pré-custo.

Dados esperados:

* Unidade
* Serviço
* Meta financeira
* Data
* Dia da semana
* Receitas
* Custo individual
* Custo total da refeição

Regra crítica:

* O custo total da refeição não deve ultrapassar a meta financeira definida.

---

## Etapa 6 - Conformidade Contratual e Financeira

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

Também deve validar:

* Refeições acima da meta financeira
* Valor excedido e percentual de excedente
* Impacto financeiro mensal

---

## Etapa 7 - Sugestões de Ajuste e Nova Versão

Com base na auditoria contratual e financeira, o sistema sugere ajustes para:

* elevar conformidade
* reduzir excedentes de custo
* manter aderência nutricional

Ao gerar versão ajustada, cada alteração deve informar:

* regra que motivou a alteração
* impacto financeiro
* impacto nutricional

---

## Etapa 8 - Importação e Cruzamento de Avaliações

O sistema importa avaliações das refeições (PDF) e relaciona cada avaliação ao cardápio servido no mesmo contexto (data, hora, unidade e serviço).

Campos relevantes:

* Nota
* Quantidade de avaliações
* Observações e comentários

---

## Etapa 9 - Inteligência de Combinações

Cada combinação passa a ter histórico operacional:

* nota média
* quantidade de avaliações
* última utilização
* tendência

---

## Etapa 10 - Recomendações Futuras

Ao apoiar o próximo cardápio, considerar simultaneamente:

* regras contratuais aprovadas
* metas financeiras
* restrições nutricionais
* histórico de aceitação

Regra de governança:

* histórico de avaliações é fator de recomendação, não fator de bloqueio.

Ordem de prioridade decisória:

1. regras contratuais aprovadas
2. metas financeiras
3. restrições nutricionais
4. regras operacionais
5. histórico de avaliações

---

## Política do Motor de Recomendações

O motor de recomendações deve operar com três camadas:

* Obrigatório: contrato, custo, restrição obrigatória e regra operacional crítica.
* Recomendado: histórico de aceitação de combinações.
* Informativo: ausência de histórico e sinais contextuais.

Regras essenciais:

* Nota baixa não invalida combinação.
* Ausência de histórico não gera erro.
* Combinação com baixa aceitação continua válida se estiver conforme em contrato, custo e nutrição.
* Sistema pode sugerir alternativa melhor avaliada, mas não bloquear decisão do nutricionista.

Criterios que podem bloquear aprovação:

* descumprimento de regra contratual obrigatória
* violação de restrição alimentar obrigatória
* ultrapassagem da meta financeira definida
* violação de regra operacional crítica

Avaliações históricas nunca podem bloquear geração ou aprovação de cardápio.

---

# Conceitos de Negócio

## Receita (Base Estruturada)

A receita deve ser tratada como entidade estruturada reutilizavel pelo sistema.

Campos esperados quando disponiveis:

* Nome
* Ingredientes
* Modo de preparo
* Per capita
* Rendimento
* Grupo alimentar
* Valor nutricional

A classificacao automatica deve mapear categoria, subcategoria e grupo alimentar.

Exemplos:

* Laranja -> Fruta / Fruta Cítrica
* Ponkan -> Fruta / Fruta Cítrica
* Maçã -> Fruta / Fruta Não Cítrica
* Salmão com Crosta de Ervas -> Proteína / Peixe

Essa base estruturada deve ser a fonte primária para:

* Auditoria de conformidade
* Sugestões financeiras de substituição
* Inteligência de combinações e avaliações

---

## Contrato

Documento enviado pelo cliente contendo regras e exigências.

---

## Regra Contratual

Representa um requisito extraído e validado.

Toda regra deve manter vínculo com evidência documental.

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

Planejamento alimentar operacional gerado no sistema parceiro (Genial), auditado e otimizado no MenuCare.

---

## Conformidade

Indicador que mede aderência do cardápio às regras aprovadas.

Inclui também aderência financeira à meta por refeição.

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

Evitar também linguagem de acurácia percentual na interface (ex.: "96% de acerto").

Preferir classificação qualitativa:

* Alta Correspondência
* Média Correspondência
* Baixa Correspondência
* Revisão Recomendada

A plataforma deve transmitir segurança, governança, conformidade, rastreabilidade e controle operacional.
