export type RulePreparationInput = {
  companyName: string
  contractId: string
  title: string
  description: string
  category: string
}

export type MenuPreparationInput = {
  companyName: string
  importId: string
  unitName: string
  serviceName: string
  referenceDate: string
  monthsAhead: number
  recipes: string[]
  targetMonth: string
  commemorativeDates: Array<{
    referenceDate: string
    title: string
    nobleDishHint: string | null
  }>
}

export type RecipeImportInput = {
  companyName: string
  sourceFileName: string
  recipes: Array<{
    name: string
    ingredients: string[]
    preparationMethod?: string | null
    perCapita?: number | null
    yield?: number | null
    group?: string | null
    nutritionalInfo?: Record<string, unknown> | null
    compatibleDiets?: string[]
    allergens?: string[]
    cost?: number | null
  }>
}

export type RecipeClassification = {
  category: string
  subcategory: string
  foodGroup: string
  confidence: number
  tags: string[]
}

const normalize = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()

const tokenize = (value: string) =>
  normalize(value)
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 2)

export const classifyRecipeFromText = (name: string, ingredients: string[] = []): RecipeClassification => {
  const text = normalize([name, ...ingredients].join(' '))
  const tokens = tokenize(text)

  const containsAny = (candidates: string[]) =>
    candidates.some((candidate) => text.includes(normalize(candidate)))

  if (containsAny(['laranja', 'ponkan', 'tangerina', 'mexerica', 'limao', 'acai', 'uva'])) {
    return {
      category: 'Fruta',
      subcategory: containsAny(['laranja', 'ponkan', 'tangerina', 'mexerica', 'limao'])
        ? 'Fruta Citrica'
        : 'Fruta Nao Citrica',
      foodGroup: 'Frutas',
      confidence: 0.93,
      tags: ['fruit', 'citrus'],
    }
  }

  if (containsAny(['salmao', 'tilapia', 'merluza', 'pescada', 'peixe', 'bacalhau'])) {
    return {
      category: 'Proteina',
      subcategory: 'Peixe',
      foodGroup: 'Proteinas',
      confidence: 0.94,
      tags: ['protein', 'fish'],
    }
  }

  if (containsAny(['frango', 'galinha', 'file de frango', 'coxa', 'sobrecoxa'])) {
    return {
      category: 'Proteina',
      subcategory: 'Frango',
      foodGroup: 'Proteinas',
      confidence: 0.92,
      tags: ['protein', 'poultry'],
    }
  }

  if (containsAny(['bife', 'carne', 'patinho', 'alcatra', 'coxao mole', 'coxao duro'])) {
    return {
      category: 'Proteina',
      subcategory: 'Bovino',
      foodGroup: 'Proteinas',
      confidence: 0.9,
      tags: ['protein', 'beef'],
    }
  }

  if (containsAny(['arroz', 'massas', 'macarrao', 'pao', 'mandioca', 'batata', 'pure'])) {
    return {
      category: 'Carboidrato',
      subcategory: 'Base',
      foodGroup: 'Carboidratos',
      confidence: 0.81,
      tags: ['carbohydrate'],
    }
  }

  if (containsAny(['alface', 'couve', 'espinafre', 'brocolis', 'cenoura', 'abobrinha', 'chuchu', 'legume'])) {
    return {
      category: 'Legume',
      subcategory: 'Hortifruti',
      foodGroup: 'Vegetais',
      confidence: 0.8,
      tags: ['vegetable'],
    }
  }

  const inferredCategory = tokens.some((token) => token.length >= 8) ? 'Preparacao' : 'Outros'

  return {
    category: inferredCategory,
    subcategory: 'Nao classificado',
    foodGroup: 'Outros',
    confidence: 0.48,
    tags: tokens.slice(0, 6),
  }
}

export const buildRulePreparationContext = (input: RulePreparationInput) => {
  const tokens = tokenize(`${input.title} ${input.description} ${input.category}`)

  return {
    module: 'rules',
    companyName: input.companyName,
    contractId: input.contractId,
    source: 'structured-ready',
    normalizedTokens: tokens.slice(0, 24),
    subject: input.title,
    intentSummary: input.description,
    category: input.category,
  }
}

export const buildMenuPreparationContext = (input: MenuPreparationInput) => {
  const recipeTokens = input.recipes.flatMap((recipe) => tokenize(recipe))
  const commemorativeTitles = input.commemorativeDates.map((item) => item.title)

  return {
    module: 'menus',
    companyName: input.companyName,
    importId: input.importId,
    source: 'structured-ready',
    targetMonth: input.targetMonth,
    planningMonthsAhead: input.monthsAhead,
    recipeTokens: recipeTokens.slice(0, 40),
    commemorativeTitles,
    nobleDishPriorityEnabled: input.commemorativeDates.length > 0,
    recipeCount: input.recipes.length,
  }
}

export const buildRecipeImportContext = (input: RecipeImportInput) => {
  const classified = input.recipes.map((recipe) => ({
    name: recipe.name,
    ingredients: recipe.ingredients,
    classification: classifyRecipeFromText(recipe.name, recipe.ingredients),
  }))

  return {
    module: 'recipes',
    companyName: input.companyName,
    sourceFileName: input.sourceFileName,
    source: 'structured-ready',
    totalRecipes: classified.length,
    classifiedRecipes: classified,
  }
}
