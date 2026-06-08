# REGRAS DE NEGOCIO - MOTOR DE RECOMENDACAO DE COMBINACOES

## Principio fundamental
As avaliacoes historicas NAO sao regras obrigatorias.

As avaliacoes historicas sao informacoes de apoio para tomada de decisao.

O sistema nunca deve bloquear, impedir ou invalidar uma combinacao apenas porque ela possui nota baixa ou nao possui historico.

---

## Ordem de prioridade
Ao gerar ou sugerir cardapios, a prioridade deve ser:

1. Regras contratuais aprovadas
2. Meta financeira da refeicao
3. Restricoes nutricionais
4. Regras operacionais
5. Historico de avaliacoes

As avaliacoes possuem prioridade inferior aos requisitos contratuais.

---

## Conceitos de decisao
### Obrigatorio (Contrato)
Exemplos:
- Proteina no jantar
- Fruta citrica 3x semana
- Maximo de custo por refeicao

Se descumprir, status: Nao Conforme.

### Recomendado (Historico)
Exemplo:
- Combinacao com nota media alta

Se ignorar, o cardapio continua valido.

### Informativo
Exemplo:
- Sem historico de avaliacoes para a combinacao

Sem impacto na aprovacao.

---

## Ausencia de historico
Se uma combinacao nunca foi utilizada:
- Nao classificar como erro
- Nao impedir geracao
- Nao apresentar alerta critico
- Exibir: "Sem historico de avaliacoes"

---

## Nota baixa
Se uma combinacao possuir nota baixa:
- Nao impedir utilizacao
- Nao invalidar cardapio
- Exibir indicador informativo

Mensagem exemplo:
"Atencao: esta combinacao possui historico de aceitacao abaixo da media."

---

## Sugestoes inteligentes
O sistema pode sugerir combinacoes alternativas com melhor aceitacao historica.

O sistema nunca pode:
- Bloquear
- Impedir
- Invalidar
- Rejeitar automaticamente

---

## Criterios de bloqueio (unicos)
Somente os seguintes criterios podem impedir aprovacao de um cardapio:
- Descumprimento de regra contratual obrigatoria
- Violacao de restricao alimentar obrigatoria
- Ultrapassagem da meta financeira definida
- Violacao de regra operacional critica

Avaliacoes historicas nunca bloqueiam geracao ou aprovacao.

---

## Filosofia do produto
O nutricionista continua sendo o responsavel tecnico pelas decisoes.

O sistema fornece informacoes, indicadores e recomendacoes.

A decisao final sempre pertence ao profissional.
