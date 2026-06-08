# MENUCARE - ESCOPO FUNCIONAL COMPLETO

## Visao Geral
MenuCare e uma plataforma SaaS de Gestao Contratual, Conformidade e Planejamento Alimentar.

O sistema foi criado para hospitais, empresas de alimentacao coletiva, cozinhas industriais, hoteis, escolas e operacoes que precisam garantir que seus cardapios estejam aderentes aos requisitos definidos em contratos, editais, termos de referencia e documentos regulatorios.

O MenuCare nao deve ser tratado como uma plataforma de Inteligencia Artificial.

A tecnologia utilizada internamente e apenas um mecanismo de apoio ao processamento documental.

O foco da experiencia do usuario deve ser:

- Governanca
- Conformidade
- Auditoria
- Rastreabilidade
- Seguranca
- Padronizacao
- Controle Operacional

---

## Fluxo Principal do Produto

```text
Contrato

↓

Processamento Documental

↓

Regras Identificadas

↓

Validacao Humana

↓

Base Contratual

↓

Planejamento de Cardapios

↓

Auditoria de Conformidade

↓

Relatorios e Evidencias
```

---

## Arquitetura SaaS

### Conceito
O sistema e Multi-Cliente.

Porem o usuario nunca deve visualizar termos tecnicos.

Nunca exibir:

- Tenant
- TenantId
- Multi Tenant
- Role
- RBAC
- Claims

Utilizar:

- Cliente
- Empresa
- Organizacao
- Unidade

---

## Perfis de Acesso

### Administrador MenuCare
Representa os proprietarios da plataforma.

Nao utiliza os modulos operacionais.

#### Menu

- Dashboard SaaS
- Clientes
- Planos
- Licencas
- Assinaturas
- Logs Globais
- Configuracoes Globais

#### Responsabilidades

- Criar clientes
- Ativar clientes
- Suspender clientes
- Vincular administradores
- Gerenciar planos
- Monitorar utilizacao

---

### Administrador do Cliente
Representa o gestor principal do cliente.

#### Menu

- Dashboard
- Contratos
- Regras Contratuais
- Cardapios
- Conformidade
- Analises
- Usuarios
- Configuracoes
- Ajuda e Suporte

#### Responsabilidades

- Gerenciar usuarios
- Aprovar regras
- Gerenciar contratos
- Gerenciar cardapios
- Gerenciar conformidade

---

### Usuario Operacional
Representa nutricionistas, analistas e supervisores.

#### Menu

- Dashboard
- Contratos
- Regras Contratuais
- Cardapios
- Conformidade
- Analises
- Tarefas
- Ajuda e Suporte

#### Restricoes
Nao pode:

- Criar usuarios
- Alterar permissoes
- Alterar configuracoes da empresa

---

## Modulo de Clientes
Disponivel apenas para Administrador MenuCare.

### Cadastro
Campos:

- Razao Social
- Nome Fantasia
- CNPJ
- E-mail
- Telefone
- Plano
- Quantidade de Usuarios
- Status

---

### Administrador Inicial
Durante o cadastro do cliente:

Criar automaticamente:

- Nome
- E-mail
- Cargo

Enviar convite de acesso.

---

## Convites
Fluxo:

```text
Administrador cria usuario

↓

Sistema gera convite

↓

E-mail enviado

↓

Usuario define senha

↓

Conta ativada
```

Nunca utilizar linguagem tecnica.

Utilizar:

"Convite de acesso"

e nao:

"Token"

---

## Login
Campos:

- E-mail
- Senha

Links:

- Esqueci minha senha
- Ativar convite

---

## Dashboard

### KPIs

- Contratos Ativos
- Regras Aprovadas
- Regras Pendentes
- Cardapios Gerados
- Taxa de Conformidade

---

### Widgets

- Contratos recentes
- Atividades recentes
- Proximas revisoes
- Alertas
- Indicadores de conformidade

---

## Modulo Contratos

### Objetivo
Gerenciar documentos que definem requisitos operacionais.

Tipos:

- Contrato
- Edital
- Licitacao
- Termo de Referencia
- POP
- Regulamento
- Manual

---

### Funcionalidades

- Upload
- Visualizacao
- Download
- Historico
- Versionamento

---

### Status

- Recebido
- Em Processamento
- Regras Identificadas
- Aguardando Validacao
- Concluido

Nunca exibir:

"IA processando"

Utilizar:

"Processando documento"

ou

"Identificando requisitos"

---

## Modulo Regras Contratuais

### Objetivo
Apresentar regras identificadas nos documentos.

Este e o modulo mais importante da plataforma.

---

### Layout
Duas colunas.

#### Esquerda
Lista de regras.

#### Direita
Painel de evidencia.

---

### Campos da Regra

- Titulo
- Categoria
- Descricao
- Texto Original
- Pagina
- Clausula
- Documento
- Nivel de Correspondencia
- Status

---

### Nivel de Correspondencia
Utilizar:

- Alta Correspondencia
- Media Correspondencia
- Baixa Correspondencia
- Revisao Recomendada

Nunca utilizar:

"Confianca da IA"

---

### Acoes

- Aprovar
- Editar
- Rejeitar
- Arquivar

---

### Evidencia
Ao clicar na regra, exibir:

- Documento
- Pagina
- Clausula
- Trecho encontrado

Destacar visualmente o trecho identificado.

Objetivo:

Permitir validacao rapida.

---

## Base Contratual
Representa o conjunto oficial de regras aprovadas.

Somente regras aprovadas podem ser utilizadas.

---

## Categorias de Regras

- Refeicoes
- Proteinas
- Frutas
- Vegetais
- Bebidas
- Sobremesas
- Dietas Especiais
- Restricoes Alimentares
- Horarios
- Frequencias
- Quantidades
- Seguranca Alimentar
- Qualidade
- Operacao

---

## Cardapios

### Objetivo
Criar cardapios aderentes a Base Contratual.

### Funcionalidades

- Criar
- Editar
- Duplicar
- Versionar
- Publicar
- Exportar PDF

### Estrutura

- Nome
- Competencia
- Unidade
- Categoria
- Status
- Versao

---

## Biblioteca de Preparacoes
Cadastro de receitas padronizadas.

Campos:

- Nome
- Ingredientes
- Grupo Alimentar
- Modo de Preparo
- Rendimento
- Valor Nutricional
- Alergenos

---

## Ingredientes
Base unica de ingredientes.

Campos:

- Nome
- Grupo Alimentar
- Calorias
- Proteinas
- Carboidratos
- Gorduras
- Fibras

---

## Fichas Tecnicas
Cada preparacao deve possuir ficha tecnica completa.

---

## Catalogo de Dietas
Exemplos:

- Livre
- Branda
- Pastosa
- Hipossodica
- Hipoglicidica
- Diabetica
- Enteral

---

## Conformidade

### Objetivo
Comparar cardapios com regras aprovadas.

### Resultado

- Conforme
- Parcialmente Conforme
- Nao Conforme

### Exemplo
Regra: Fruta citrica 3 vezes por semana

Cardapio: 2 ocorrencias

Resultado: Nao Conforme

---

## Auditoria

### Objetivo
Garantir rastreabilidade completa.

Registrar:

- Quem aprovou
- Quando aprovou
- Alteracoes realizadas
- Historico de versoes

---

## Evidencias de Conformidade
Para cada auditoria exibir:

- Regra
- Evidencia contratual
- Evidencia no cardapio
- Resultado

---

## Gestao de Nao Conformidades
Criar modulo especifico.

Campos:

- Descricao
- Origem
- Impacto
- Responsavel
- Prazo
- Status

---

## Plano de Acao
Cada nao conformidade pode gerar:

- Responsavel
- Prazo
- Acompanhamento
- Historico

---

## Gestao de Versoes Contratuais
Contratos podem possuir:

- Contrato Original
- Aditivos
- Revisoes

### Comparacao de Versoes
O sistema deve identificar:

- Regras adicionadas
- Regras removidas
- Regras alteradas

---

## Linha do Tempo Contratual
Visualizacao historica.

Exemplo:

```text
2025 - Contrato Original

2026 - Aditivo 1

2027 - Aditivo 2

2028 - Nova Revisao
```

Exibir:

- Mudancas realizadas
- Regras afetadas
- Usuarios envolvidos

---

## Central de Conhecimento Contratual
Permitir pesquisar:

- Regras
- Contratos
- Clausulas
- Categorias

Objetivo:

Transformar conhecimento contratual em base consultavel.

---

## Ajuda e Suporte
Disponivel em todas as telas.

Funcionalidades:

- Abrir chamado
- Consultar documentacao
- Assistir treinamentos
- Acompanhar solicitacoes

---

## Principio Fundamental do Produto
O MenuCare nao toma decisoes sozinho.

O sistema identifica possiveis requisitos, apresenta evidencias, permite validacao humana e utiliza apenas regras aprovadas para apoiar a geracao e auditoria de cardapios.

A confianca da plataforma deve vir da rastreabilidade, da conformidade e da validacao humana, e nao da tecnologia utilizada internamente.
