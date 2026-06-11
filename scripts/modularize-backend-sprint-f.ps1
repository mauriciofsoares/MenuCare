$ErrorActionPreference = 'Stop'

$root = 'C:\MenuCare'
$serverPath = Join-Path $root 'apps/api/src/server.ts'
$lines = Get-Content -Path $serverPath

$routeStarts = @(
  @{ Start = 2056; Context = 'auth' }
  @{ Start = 2167; Context = 'auth' }
  @{ Start = 2258; Context = 'auth' }
  @{ Start = 2282; Context = 'auth' }
  @{ Start = 2292; Context = 'auth' }
  @{ Start = 2313; Context = 'auth' }
  @{ Start = 2338; Context = 'governance' }
  @{ Start = 2345; Context = 'recommendations' }
  @{ Start = 2492; Context = 'recommendations' }
  @{ Start = 2576; Context = 'recommendations' }
  @{ Start = 2693; Context = 'recommendations' }
  @{ Start = 2769; Context = 'auth' }
  @{ Start = 2842; Context = 'auth' }
  @{ Start = 2902; Context = 'auth' }
  @{ Start = 2948; Context = 'auth' }
  @{ Start = 3009; Context = 'auth' }
  @{ Start = 3084; Context = 'auth' }
  @{ Start = 3160; Context = 'auth' }
  @{ Start = 3186; Context = 'auth' }
  @{ Start = 3212; Context = 'contracts' }
  @{ Start = 3267; Context = 'menus' }
  @{ Start = 3402; Context = 'menus' }
  @{ Start = 3427; Context = 'menus' }
  @{ Start = 3477; Context = 'menus' }
  @{ Start = 3603; Context = 'menus' }
  @{ Start = 4277; Context = 'menus' }
  @{ Start = 4396; Context = 'menus' }
  @{ Start = 4969; Context = 'menus' }
  @{ Start = 5043; Context = 'menus' }
  @{ Start = 5120; Context = 'recipes' }
  @{ Start = 5346; Context = 'recipes' }
  @{ Start = 5460; Context = 'recipes' }
  @{ Start = 5541; Context = 'recipes' }
  @{ Start = 5716; Context = 'compliance' }
  @{ Start = 6121; Context = 'compliance' }
  @{ Start = 6179; Context = 'compliance' }
  @{ Start = 6593; Context = 'compliance' }
  @{ Start = 6681; Context = 'menus' }
  @{ Start = 6909; Context = 'menus' }
  @{ Start = 7004; Context = 'menus' }
  @{ Start = 7090; Context = 'menus' }
  @{ Start = 7147; Context = 'evaluations' }
  @{ Start = 7211; Context = 'evaluations' }
  @{ Start = 7273; Context = 'evaluations' }
  @{ Start = 7410; Context = 'evaluations' }
  @{ Start = 7478; Context = 'contracts' }
  @{ Start = 7521; Context = 'rules' }
  @{ Start = 7640; Context = 'rules' }
  @{ Start = 7720; Context = 'rules' }
  @{ Start = 7772; Context = 'compliance' }
  @{ Start = 7872; Context = 'compliance' }
  @{ Start = 7943; Context = 'compliance' }
  @{ Start = 8005; Context = 'compliance' }
  @{ Start = 8072; Context = 'compliance' }
  @{ Start = 8177; Context = 'compliance' }
  @{ Start = 8271; Context = 'compliance' }
  @{ Start = 8336; Context = 'compliance' }
  @{ Start = 8405; Context = 'compliance' }
  @{ Start = 8514; Context = 'compliance' }
  @{ Start = 8560; Context = 'compliance' }
  @{ Start = 8676; Context = 'compliance' }
  @{ Start = 8861; Context = 'rules' }
  @{ Start = 8931; Context = 'server' }
  @{ Start = 8992; Context = 'server' }
  @{ Start = 9001; Context = 'server' }
)

for ($i = 0; $i -lt $routeStarts.Count; $i++) {
  $current = $routeStarts[$i]
  $nextStart = if ($i -lt $routeStarts.Count - 1) { $routeStarts[$i + 1].Start } else { $lines.Count + 1 }
  $current.End = $nextStart - 1
}

$contexts = @{
  auth = @{
    Function = 'registerAuthRoutes'
    Service = 'createAuthService'
    Deps = @('apiMessage','authenticate','authSchema','consumeLoginAttempt','isLoginBlocked','demoUser','demoContext','demoPassword','prisma','readPasswordOverride','verifyPassword','issueAccessToken','getRefreshSessionDeviceContext','resolveAuthFlowId','setAuthFlowHeader','createRefreshSession','setRefreshTokenCookie','parseCookieHeader','refreshCookieName','readRefreshSession','revokeRefreshSession','clearRefreshTokenCookie','touchRefreshSession','getCompanyFromJwt','readOperationalProfile','operationalProfileSchema','saveOperationalProfile','inviteActivationSchema','ensureAuthTables','hashPassword','registerInviteAuditEvent','inviteCreationSchema','getUserFromJwt','inviteAuditQuerySchema','inviteListQuerySchema','inviteTokenParamSchema','localeByCompany','normalizeLocale','readLocaleFromDatabase','saveLocaleInDatabase','localeSchema','randomUUID')
  }
  contracts = @{
    Function = 'registerContractsRoutes'
    Service = 'createContractsService'
    Deps = @('apiMessage','authenticate','contractSchema','prisma','getCompanyFromJwt','getUserFromJwt','randomUUID','ensureDomainTables','z')
  }
  rules = @{
    Function = 'registerRulesRoutes'
    Service = 'createRulesService'
    Deps = @('apiMessage','authenticate','ruleSchema','ruleParamsSchema','ruleStatusUpdateSchema','prisma','getCompanyFromJwt','getUserFromJwt','randomUUID','ensureDomainTables','recordAiPreparationEvent','buildRulePreparationContext','z')
  }
  menus = @{
    Function = 'registerMenusRoutes'
    Service = 'createMenusService'
    Deps = @('apiMessage','authenticate','menuImportSchema','prisma','getCompanyFromJwt','getUserFromJwt','randomUUID','ensureDomainTables','menuImportParseReportSchema','buildParsedMenuImportPayload','PDFParse','operationalMenuCardapioSchema','menuMonthlyCycleQuerySchema','buildSemanticAliasByContext','resolveStructuredRecipeFromImportedName','getMonthKeyFromDate','getDateOnlyString','addUtcDays','startOfIsoWeek','diffUtcDays','extractRuleTarget','extractWeeklyMinimum','extractRecurrenceDays','normalizeTerm','inferSuggestionEvidenceSource','inferSuggestionEvidenceSubtype','adjustedVersionGenerationSchema','recordAiPreparationEvent','buildMenuPreparationContext','commemorativeDateSchema','commemorativeDateListQuerySchema','menuImportListQuerySchema','menuMonthlySummaryListQuerySchema','menuMonthlySummaryReprocessSchema','menuImportParamsSchema','z')
  }
  recipes = @{
    Function = 'registerRecipesRoutes'
    Service = 'createRecipesService'
    Deps = @('apiMessage','authenticate','recipeImportSchema','prisma','getCompanyFromJwt','getUserFromJwt','ensureDomainTables','buildRecipeImportContext','recordAiPreparationEvent','classifyRecipeFromText','normalizeTerm','randomUUID','recipeParamsSchema','recipeClassificationUpdateSchema')
  }
  compliance = @{
    Function = 'registerComplianceRoutes'
    Service = 'createComplianceService'
    Deps = @('apiMessage','authenticate','menuImportParamsSchema','prisma','getCompanyFromJwt','ensureDomainTables','normalizeTerm','getDateOnlyString','buildSemanticAliasByContext','resolveStructuredRecipeFromImportedName','startOfIsoWeek','addUtcDays','extractRuleTarget','extractWeeklyMinimum','extractRecurrenceDays','diffUtcDays','inferSuggestionEvidenceSource','inferSuggestionEvidenceSubtype','randomUUID','nonConformitySchema','nonConformityParamsSchema','nonConformityStatusSchema','nonConformityHistoryQuerySchema','getUserFromJwt','actionPlanSchema','actionPlanParamsSchema','actionPlanStatusSchema','actionPlanHistoryQuerySchema','complianceExportAuditQuerySchema','z')
  }
  evaluations = @{
    Function = 'registerEvaluationsRoutes'
    Service = 'createEvaluationsService'
    Deps = @('apiMessage','authenticate','evaluationImportSchema','evaluationImportListQuerySchema','intelligenceListQuerySchema','prisma','getCompanyFromJwt','ensureDomainTables','randomUUID')
  }
  recommendations = @{
    Function = 'registerRecommendationsRoutes'
    Service = 'createRecommendationsService'
    Deps = @('apiMessage','authenticate','menuImportParamsSchema','prisma','getCompanyFromJwt','ensureDomainTables','recommendationPolicyContract','buildNextMenuProposal','recordAiPreparationEvent','buildMenuPreparationContext','nextMenuDecisionSchema','getUserFromJwt','randomUUID','nextMenuDecisionListQuerySchema')
    Types = "type NextMenuProposalData = any;"
  }
  governance = @{
    Function = 'registerGovernanceRoutes'
    Service = 'createGovernanceService'
    Deps = @('authenticate','recommendationPolicyContract')
  }
}

$contextsOrder = @('auth','contracts','rules','menus','recipes','compliance','evaluations','recommendations','governance')

foreach ($contextName in $contextsOrder) {
  $contextDir = Join-Path $root "apps/api/src/modules/$contextName"
  New-Item -ItemType Directory -Force -Path $contextDir | Out-Null

  $serviceFile = Join-Path $contextDir 'service.ts'
  $repoFile = Join-Path $contextDir 'repository.ts'
  $routesFile = Join-Path $contextDir 'routes.ts'

  $serviceName = $contexts[$contextName].Service
  $repoName = 'create' + ([char]::ToUpper($contextName[0]) + $contextName.Substring(1)) + 'Repository'

  [System.IO.File]::WriteAllText($repoFile, "export const $repoName = (deps: Record<string, any>) => deps;`r`n")
  [System.IO.File]::WriteAllText($serviceFile, "import { $repoName } from './repository.js';`r`n`r`nexport const $serviceName = (deps: Record<string, any>) => ({`r`n  ...deps,`r`n  repository: $repoName(deps),`r`n});`r`n")

  $routesForContext = $routeStarts | Where-Object { $_.Context -eq $contextName }
  $blocks = @()
  foreach ($route in $routesForContext) {
    $blockLines = $lines[($route.Start - 1)..($route.End - 1)]
    $blocks += (($blockLines -join "`r`n").TrimEnd())
  }

  $typeAlias = if ($contexts[$contextName].ContainsKey('Types')) { $contexts[$contextName].Types + "`r`n`r`n" } else { '' }
  $depsList = $contexts[$contextName].Deps -join ', '
  $routesContent = @"
import type { FastifyInstance } from 'fastify';
import { $serviceName } from './service.js';

${typeAlias}export const $($contexts[$contextName].Function) = (app: FastifyInstance, deps: Record<string, any>) => {
  const service = $serviceName(deps);
  const { $depsList } = service;

$($blocks -join "`r`n`r`n")
};
"@

  [System.IO.File]::WriteAllText($routesFile, $routesContent)
}

$removeLines = New-Object 'System.Collections.Generic.HashSet[int]'
foreach ($route in ($routeStarts | Where-Object { $_.Context -ne 'server' })) {
  for ($line = $route.Start; $line -le $route.End; $line++) {
    $removeLines.Add($line) | Out-Null
  }
}

$keptLines = New-Object System.Collections.Generic.List[string]
for ($lineNumber = 1; $lineNumber -le $lines.Count; $lineNumber++) {
  if (-not $removeLines.Contains($lineNumber)) {
    $keptLines.Add($lines[$lineNumber - 1])
  }
}

$serverContent = $keptLines -join "`r`n"

$importsToAdd = @"
import { registerAuthRoutes } from './modules/auth/routes.js';
import { registerContractsRoutes } from './modules/contracts/routes.js';
import { registerRulesRoutes } from './modules/rules/routes.js';
import { registerMenusRoutes } from './modules/menus/routes.js';
import { registerRecipesRoutes } from './modules/recipes/routes.js';
import { registerComplianceRoutes } from './modules/compliance/routes.js';
import { registerEvaluationsRoutes } from './modules/evaluations/routes.js';
import { registerRecommendationsRoutes } from './modules/recommendations/routes.js';
import { registerGovernanceRoutes } from './modules/governance/routes.js';
"@

$registrationBlock = @"
const moduleDeps = {
  z,
  PDFParse,
  apiMessage,
  authenticate,
  authSchema,
  consumeLoginAttempt,
  isLoginBlocked,
  demoUser,
  demoContext,
  demoPassword,
  prisma,
  readPasswordOverride,
  verifyPassword,
  issueAccessToken,
  getRefreshSessionDeviceContext,
  resolveAuthFlowId,
  setAuthFlowHeader,
  createRefreshSession,
  setRefreshTokenCookie,
  parseCookieHeader,
  refreshCookieName,
  readRefreshSession,
  revokeRefreshSession,
  clearRefreshTokenCookie,
  touchRefreshSession,
  getCompanyFromJwt,
  readOperationalProfile,
  operationalProfileSchema,
  saveOperationalProfile,
  inviteActivationSchema,
  ensureAuthTables,
  hashPassword,
  registerInviteAuditEvent,
  inviteCreationSchema,
  getUserFromJwt,
  inviteAuditQuerySchema,
  inviteListQuerySchema,
  inviteTokenParamSchema,
  localeByCompany,
  normalizeLocale,
  readLocaleFromDatabase,
  saveLocaleInDatabase,
  localeSchema,
  randomUUID,
  contractSchema,
  ensureDomainTables,
  buildRulePreparationContext,
  ruleSchema,
  ruleParamsSchema,
  ruleStatusUpdateSchema,
  recordAiPreparationEvent,
  menuImportSchema,
  buildParsedMenuImportPayload,
  operationalMenuCardapioSchema,
  menuMonthlyCycleQuerySchema,
  buildSemanticAliasByContext,
  resolveStructuredRecipeFromImportedName,
  getMonthKeyFromDate,
  getDateOnlyString,
  addUtcDays,
  startOfIsoWeek,
  diffUtcDays,
  extractRuleTarget,
  extractWeeklyMinimum,
  extractRecurrenceDays,
  normalizeTerm,
  inferSuggestionEvidenceSource,
  inferSuggestionEvidenceSubtype,
  adjustedVersionGenerationSchema,
  buildMenuPreparationContext,
  commemorativeDateSchema,
  commemorativeDateListQuerySchema,
  menuImportListQuerySchema,
  menuMonthlySummaryListQuerySchema,
  menuMonthlySummaryReprocessSchema,
  menuImportParamsSchema,
  recipeImportSchema,
  buildRecipeImportContext,
  classifyRecipeFromText,
  recipeParamsSchema,
  recipeClassificationUpdateSchema,
  nonConformitySchema,
  nonConformityParamsSchema,
  nonConformityStatusSchema,
  nonConformityHistoryQuerySchema,
  actionPlanSchema,
  actionPlanParamsSchema,
  actionPlanStatusSchema,
  actionPlanHistoryQuerySchema,
  complianceExportAuditQuerySchema,
  evaluationImportSchema,
  evaluationImportListQuerySchema,
  intelligenceListQuerySchema,
  recommendationPolicyContract,
  buildNextMenuProposal,
  nextMenuDecisionSchema,
  nextMenuDecisionListQuerySchema,
};

registerAuthRoutes(app, moduleDeps);
registerContractsRoutes(app, moduleDeps);
registerRulesRoutes(app, moduleDeps);
registerMenusRoutes(app, moduleDeps);
registerRecipesRoutes(app, moduleDeps);
registerComplianceRoutes(app, moduleDeps);
registerEvaluationsRoutes(app, moduleDeps);
registerRecommendationsRoutes(app, moduleDeps);
registerGovernanceRoutes(app, moduleDeps);
"@

$serverContent = $serverContent.Replace("} from './ai-prep.js';", "} from './ai-prep.js';`r`n$importsToAdd")
$serverContent = $serverContent.Replace("app.get('/dashboard/summary', { preHandler: authenticate }, async (request, reply) => {", "$registrationBlock`r`napp.get('/dashboard/summary', { preHandler: authenticate }, async (request, reply) => {")

[System.IO.File]::WriteAllText($serverPath, $serverContent)
