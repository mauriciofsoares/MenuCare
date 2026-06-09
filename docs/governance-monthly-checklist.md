# MenuCare - Checklist Mensal de Governanca

Objetivo: garantir que controles de qualidade e governanca de merge continuam ativos e coerentes com a operacao.

Periodicidade:
- Executar 1 vez por mes.
- Responsavel sugerido: mantenedor principal do repositorio.
- Registrar a rodada no historico em `docs/governance-audits/` usando o template `_template.md`.
- Opcional: gerar o arquivo do mes automaticamente com `npm run governance:audit:new`.
- Validar a rodada do mes com `npm run governance:audit:check` (ou `:strict` para bloquear placeholders).

## 1. Integridade da CI
- [ ] Confirmar que o workflow `CI` continua ativo em `.github/workflows/ci.yml`.
- [ ] Validar ultima execucao em branch principal com status verde.
- [ ] Validar que o check obrigatorio segue como `CI / validate`.

## 2. Regras da branch main
- [ ] Confirmar que `Require a pull request before merging` permanece ativo.
- [ ] Confirmar que `Require status checks to pass before merging` permanece ativo.
- [ ] Confirmar que `Require branches to be up to date before merging` permanece ativo.
- [ ] Confirmar que `Require conversation resolution before merging` permanece ativo.
- [ ] Confirmar que `Require review from Code Owners` permanece ativo.

## 3. Governanca de revisao
- [ ] Revisar `.github/CODEOWNERS` e ajustar ownership por area quando houver mudanca de time.
- [ ] Garantir que o template de PR (`.github/pull_request_template.md`) segue cobrindo testes, build e riscos.
- [ ] Garantir que `CONTRIBUTING.md` continua alinhado com o fluxo operacional atual.

## 4. Triagem de demandas
- [ ] Validar que `blank_issues_enabled: false` permanece em `.github/ISSUE_TEMPLATE/config.yml`.
- [ ] Validar templates de issue (`bug_report.yml` e `feature_request.yml`) com campos atualizados.
- [ ] Revisar links de orientacao em `contact_links`.

## 5. Verificacao tecnica local
- [ ] Executar `npm test` na raiz.
- [ ] Executar `npm run build` na raiz.
- [ ] Executar `npm run ci:validate` quando houver alteracao de infraestrutura/CI.

## 6. Evidencias da rodada
- [ ] Registrar data da auditoria mensal.
- [ ] Registrar responsavel.
- [ ] Registrar desvios encontrados e plano de acao.

Modelo de registro:
- Data:
- Responsavel:
- Status geral: Conforme / Nao conforme
- Desvios:
- Acoes e prazo:

Historico mensal:
- Template: `docs/governance-audits/_template.md`
- Exemplo inicial: `docs/governance-audits/2026-06.md`
