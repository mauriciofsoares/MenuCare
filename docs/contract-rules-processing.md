# MENUCARE - PROCESSAMENTO DE CONTRATOS E REGRAS CONTRATUAIS

## Objetivo

Transformar contratos de servicos de alimentacao em uma base estruturada de regras operacionais.

As regras aprovadas serao utilizadas para:

- Geracao de cardapios
- Auditoria de cardapios
- Verificacao de conformidade
- Relatorios gerenciais
- Controle operacional

O sistema nao deve usar diretamente o texto bruto do contrato para operacoes finais.

O contrato deve ser convertido em regras estruturadas e validadas.

---

## Fluxo Oficial

1. Upload do contrato
2. Processamento documental
3. Identificacao de possiveis regras
4. Apresentacao para validacao humana
5. Aprovacao das regras
6. Formacao da Base Contratual
7. Uso da Base Contratual nos modulos de cardapio e conformidade

---

## O que e uma Regra Contratual

Regra contratual e qualquer requisito, obrigacao, restricao ou condicao operacional encontrada no documento.

Exemplos:

- Deverao ser ofertadas seis refeicoes diarias.
- Frutas citricas deverao ser servidas tres vezes por semana.
- Nao podera haver repeticao da mesma proteina em intervalo inferior a cinco dias.
- Todos os jantares deverao conter proteina de origem animal.

---

## Estrutura Obrigatoria da Regra

Toda regra deve possuir:

- Titulo
- Categoria
- Descricao
- Texto original
- Pagina
- Clausula
- Origem do documento
- Status
- Nivel de correspondencia
- Data de identificacao
- Data de aprovacao
- Usuario aprovador
- Motivo da alteracao (quando houver)

---

## Categorias de Regras

Categorias padrao:

- Refeicoes
- Horarios
- Proteinas
- Frutas
- Vegetais
- Bebidas
- Sobremesas
- Dietas especiais
- Restricoes alimentares
- Nutricao
- Seguranca alimentar
- Qualidade
- Conformidade
- Operacao
- Outros

---

## Tipos de Regras

- Obrigacao
- Restricao
- Frequencia
- Quantidade
- Prazo

---

## Niveis de Correspondencia

Nao utilizar "confianca da IA" ou percentual de acerto na interface.

Usar:

- Alta Correspondencia
- Media Correspondencia
- Baixa Correspondencia
- Revisao Recomendada

---

## Evidencia e Rastreabilidade

Toda regra deve exibir evidencia:

- Documento
- Pagina
- Clausula
- Trecho encontrado

A evidência deve ser suficiente para validacao rapida por humano.

A regra deve manter vinculo permanente com sua origem documental.

---

## Aprovacao

Acoes disponiveis:

- Aprovar
- Editar
- Rejeitar
- Arquivar

Regra de ouro:

Nenhuma regra identificada pode ser utilizada sem aprovacao humana.

Somente regras aprovadas entram na Base Contratual.

---

## Uso na Geracao e Auditoria

Geracao de cardapio:

- consultar apenas regras aprovadas

Auditoria de cardapio:

- comparar cardapio versus regras aprovadas
- classificar conforme, parcialmente conforme, nao conforme

---

## Linguagem de Interface (Obrigatoria)

Evitar completamente termos de IA na UX:

- IA
- Inteligencia Artificial
- GPT
- LLM
- Prompt
- Resultado da IA

Usar:

- Processamento Contratual
- Documento processado
- Regras identificadas
- Requisitos contratuais
- Evidencias encontradas
- Base contratual
- Motor de conformidade
- Validacao necessaria

---

## Diferencial do Produto

A confianca deve vir de:

- evidencias encontradas
- validacao humana
- rastreabilidade de ponta a ponta

Nao da tecnologia interna.

---

## Evolucao Recomendada

Controle de versao de regra por contrato:

- identificar alteracoes entre versoes contratuais
- sugerir revisao de regra alterada
- exigir nova aprovacao humana
- manter historico de versoes e justificativas
