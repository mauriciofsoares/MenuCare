# MENUCARE - FLUXO DE ANALISE DE CONTRATOS, CARDAPIOS E AVALIACOES

## Objetivo
O MenuCare nao substitui o sistema Genial.

O MenuCare funciona como uma camada de governanca, conformidade e otimizacao dos cardapios produzidos pela Genial.

O objetivo e garantir que:

- O cardapio atenda as regras contratuais.
- O cardapio respeite metas financeiras.
- O cardapio utilize combinacoes bem avaliadas.
- O nutricionista tenha suporte para tomada de decisao.

---

## Ciclo de melhoria continua
Contrato
-> Regras aprovadas
-> Cardapio atual (Genial)
-> Auditoria contratual
-> Sugestoes de ajuste
-> Novo cardapio
-> Avaliacao dos pacientes/clientes
-> Aprendizado das combinacoes
-> Proximo cardapio melhor

---

## Etapa 1 - Contrato
### Upload do contrato
Formatos aceitos:
- PDF
- DOCX

Tipos comuns:
- Contratos
- Editais
- Termos de Referencia
- Procedimentos Operacionais

### Identificacao de regras
Exemplos de requisitos operacionais:
- Fruta citrica 3 vezes por semana
- Proteina obrigatoria no jantar
- Nao repetir proteina antes de 5 dias
- Sobremesa dietetica obrigatoria

### Validacao humana
Acoes:
- Aprovar
- Editar
- Rejeitar
- Arquivar

Somente regras aprovadas entram na Base Contratual.

---

## Etapa 2 - Importacao do relatorio de cardapio com pre-custo
### Objetivo
Importar o relatorio produzido pela Genial e interpretar automaticamente o PDF.

### Estrutura esperada por registro
- Unidade
- Servico (Cafe da Manha, Almoco, Jantar, Lanche da Tarde, Ceia, Lanche da Madrugada)
- Meta Financeira
- Data
- Dia da Semana
- Receitas
- Custo Individual
- Custo Total da Refeicao

Regra critica:
O custo total nunca deve ultrapassar a meta financeira definida para a refeicao.

---

## Etapa 3 - Auditoria contratual
Comparar:
- Cardapio
- Regras aprovadas

Exemplos de resultado:
- Fruta citrica 3 vezes por semana -> encontradas 2 ocorrencias -> Nao Conforme
- Proteina obrigatoria no jantar -> todos os jantares possuem proteina -> Conforme

---

## Etapa 4 - Analise financeira
Comparar:
- Meta
- Custo

Exibir:
- Valor excedido
- Percentual excedido
- Impacto mensal

---

## Etapa 5 - Sugestoes de ajuste
Objetivo:
Tornar o cardapio conforme sem ultrapassar a meta.

Exemplos:
- Proteina repetida -> substituir por alternativa adequada
- Fruta citrica insuficiente -> incluir ocorrencia no dia recomendado
- Custo acima da meta -> substituir item por alternativa equivalente

---

## Etapa 6 - Geracao de novo cardapio
Acao do nutricionista:
- Gerar versao ajustada

Cada alteracao deve informar:
- Qual regra motivou a alteracao
- Impacto financeiro
- Impacto nutricional

---

## Etapa 7 - Importacao das avaliacoes das refeicoes
### Objetivo
Aprender quais combinacoes possuem melhor aceitacao.

### Fonte
- Upload de PDF das avaliacoes realizadas nas unidades

### Campos extraidos
- Data
- Hora
- Unidade
- Servico
- Nota
- Quantidade de Avaliacoes
- Observacoes
- Comentarios

---

## Etapa 8 - Cruzamento das avaliacoes
Relacionar:
- Avaliacao
- Cardapio servido naquele momento

Resultado esperado:
- Identificar combinacoes altamente aprovadas
- Identificar combinacoes com baixa aceitacao

---

## Etapa 9 - Inteligencia de combinacoes
Cada combinacao deve possuir:
- Nota media
- Quantidade de avaliacoes
- Ultima utilizacao
- Tendencia

---

## Etapa 10 - Recomendacoes futuras
Ao criar novos cardapios, considerar:
1. Regras contratuais aprovadas
2. Metas financeiras
3. Restricoes nutricionais
4. Regras operacionais
5. Avaliacoes historicas

Objetivo:
Priorizar combinacoes que atendam contrato, custo e aceitacao.

Regra mandatória:
Avaliacoes historicas sao apoio de decisao e nunca criterio de bloqueio.

---

## Politica do motor de recomendacao

### Camadas de decisao
Obrigatorio (bloqueia quando violado):
- Regras contratuais aprovadas
- Meta financeira da refeicao
- Restricoes nutricionais obrigatorias
- Regras operacionais criticas

Recomendado (nao bloqueia):
- Historico de avaliacoes das combinacoes

Informativo (nao bloqueia):
- Sem historico de avaliacoes
- Sinais de tendencia

### Regras operacionais
- Nota baixa nao invalida combinacao.
- Ausencia de historico nao gera erro.
- Sistema pode sugerir alternativa semelhante mais bem avaliada.
- Sistema nunca pode bloquear, impedir, invalidar ou rejeitar automaticamente por nota baixa/ausencia de historico.

### Responsabilidade tecnica
O nutricionista permanece como decisor final.
O sistema fornece indicadores e recomendacoes, sem substituir decisao profissional.

---

## Diferencial do MenuCare
O MenuCare nao e um gerador simples de cardapios.

E uma plataforma de:
- Governanca Contratual
- Auditoria de Cardapios
- Controle Financeiro
- Gestao de Conformidade
- Aprendizado de Aceitacao Alimentar
