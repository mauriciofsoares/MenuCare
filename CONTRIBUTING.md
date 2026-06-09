# Contribuindo com o MenuCare

Este repositorio segue um fluxo de contribuicao orientado a governanca, rastreabilidade e qualidade tecnica.

## Fluxo recomendado
1. Crie uma branch a partir de `main`.
2. Implemente a mudanca com escopo pequeno e objetivo.
3. Rode as validacoes locais:
   - `npm test`
   - `npm run build`
   - `npm run ci:validate` (quando aplicavel)
4. Atualize documentacao quando houver impacto de comportamento, API ou operacao.
5. Abra Pull Request preenchendo o template em `.github/pull_request_template.md`.
6. Aguarde CI verde e revisao antes de merge.

## Padrao de Pull Request
- Informe contexto e objetivo da mudanca.
- Declare impacto por camada (API, UI, banco, CI).
- Inclua evidencias de validacao.
- Descreva riscos e estrategia de rollback.

## Boas praticas
- Prefira mudancas pequenas e incrementais.
- Evite misturar refatoracao ampla com feature no mesmo PR.
- Mantenha nomenclatura orientada ao negocio na UX.
- Nao exponha termos tecnicos sensiveis ao usuario final.

## Quando abrir Issue
Use os templates em `.github/ISSUE_TEMPLATE` para registrar:
- Bugs
- Solicitaçoes de funcionalidade

Isso melhora priorizacao, reproducao e planejamento.
