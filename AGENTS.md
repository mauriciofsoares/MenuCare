# MenuCare - AGENTS

Este arquivo define regras obrigatorias para qualquer agente de IA que atue no repositorio.

## 1) O que e o MenuCare
MenuCare e uma plataforma SaaS de governanca, conformidade e rastreabilidade de operacoes de cardapio institucional.

Objetivo principal:
- transformar contratos, regras operacionais, cardapios, receitas e avaliacoes em decisoes auditaveis.

Nao e objetivo principal:
- gerar cardapio automaticamente sem governanca.

## 2) Regras inegociaveis
- IA nunca e autoridade final.
- Toda decisao critica exige aprovacao humana.
- Conformidade operacional deve ser deterministica.
- Toda recomendacao precisa de evidencia e rastreabilidade.
- Nunca quebrar isolamento multi-tenant.
- Nunca adicionar DDL runtime em endpoints.

## 3) O que nunca pode ser feito
- Nao usar LLM para decidir aprovacao/reprovacao operacional.
- Nao gravar ou consultar dados sem escopo do tenant autenticado.
- Nao criar/alterar tabelas dentro do fluxo HTTP de negocio.
- Nao centralizar novas regras de negocio em arquivos monoliticos.
- Nao introduzir termos tecnicos sensiveis na UX (tenant, token, RBAC, claims).

## 4) Organizacao de codigo (alvo)
Backend por contexto de negocio em `apps/api/src/modules`:
- auth
- contracts
- rules
- menus
- recipes
- evaluations
- compliance
- non-conformities
- recommendations
- governance

Cada modulo deve conter:
- routes
- service
- repository
- schemas

Handlers HTTP devem ser finos:
- validar entrada
- chamar servico
- retornar resposta

Frontend por feature de dominio:
- contracts
- compliance
- recipes
- recommendations
- governance

## 5) Multi-tenant
- Toda entidade operacional deve ter `tenant_id`.
- `tenant_id` sempre derivado da identidade autenticada.
- Nunca confiar em `tenant_id` vindo da interface.
- Toda consulta/mutacao deve filtrar por tenant.

## 6) Auditoria e evidencias
Entidades criticas devem registrar:
- quem alterou
- quando alterou
- o que mudou

Toda recomendacao deve incluir:
- origem
- motivo
- regra relacionada
- evidencia utilizada

## 7) IA e processamento documental
IA pode:
- extrair
- classificar
- sugerir

IA nao pode:
- aprovar
- publicar
- desbloquear nao conformidade
- decidir etapa critica

Diretriz de arquitetura:
- processamento pesado deve ser assincrono (job/fila/worker)
- API transacional nao deve executar carga pesada bloqueante

## 8) Banco e migrations
- Prisma deve refletir o dominio real.
- Alteracoes de schema somente por migrations versionadas.
- Proibido manter logica estrutural paralela permanente fora do Prisma.

## 9) Ordem de prioridades arquiteturais
1. Consolidar dominio e schema
2. Implementar migrations
3. Modularizar backend
4. Modularizar frontend
5. Implementar observabilidade
6. Introduzir filas e worker
7. Introduzir IA contratual desacoplada
8. Evoluir inteligencia operacional

Nao inverter sem justificativa tecnica documentada.

## 10) Checklist de gate para qualquer mudanca
Antes de implementar, confirmar:
1. Preserva rastreabilidade?
2. Preserva auditoria?
3. Preserva multi-tenant?
4. Preserva explicabilidade?
5. Reduz acoplamento?
6. Aproxima arquitetura do dominio?

Se qualquer resposta for "nao", reavaliar o desenho.

## 11) Referencias obrigatorias
- `docs/architecture-principles.md`
- `docs/product-specification.md`
- `docs/escopo-funcional-completo.md`
- `docs/implementation-plan.md`
- `docs/copilot-instructions.md`
