import { describe, expect, it } from 'vitest'
import {
  getMenuImportAuditEvidenceBadgeClass,
  getMenuImportAuditEvidenceLabel,
  getMenuImportAuditEvidenceType,
  getSuggestionEvidenceBadgeClass,
  getSuggestionEvidenceLabel,
  getSuggestionEvidenceType,
  type SuggestionEvidenceInput,
} from './evidence-badges'

describe('menu audit evidence badges', () => {
  it('maps structured frequency evidence correctly', () => {
    const evidence =
      'Regra avaliada por frequencia estruturada: Fruta Citrica encontrado 2 vez(es) na semana.'

    expect(getMenuImportAuditEvidenceType(evidence)).toBe('structured_frequency')
    expect(getMenuImportAuditEvidenceLabel(evidence)).toBe('Frequencia estruturada')
    expect(getMenuImportAuditEvidenceBadgeClass(evidence)).toBe('status-badge is-positive')
  })

  it('maps structured recurrence evidence correctly', () => {
    const evidence =
      'Regra avaliada por recorrencia estruturada: Peixe reapareceu apos 3 dia(s), abaixo do minimo de 7 dias.'

    expect(getMenuImportAuditEvidenceType(evidence)).toBe('structured_recurrence')
    expect(getMenuImportAuditEvidenceLabel(evidence)).toBe('Recorrencia estruturada')
    expect(getMenuImportAuditEvidenceBadgeClass(evidence)).toBe('status-badge is-neutral')
  })

  it('maps textual fallback evidence correctly', () => {
    const evidence = 'Regra com evidencia textual nas receitas importadas por fallback.'

    expect(getMenuImportAuditEvidenceType(evidence)).toBe('textual_fallback')
    expect(getMenuImportAuditEvidenceLabel(evidence)).toBe('Fallback textual')
    expect(getMenuImportAuditEvidenceBadgeClass(evidence)).toBe('status-badge is-progress')
  })
})

describe('menu suggestion evidence badges', () => {
  const makeItem = (overrides: Partial<SuggestionEvidenceInput>): SuggestionEvidenceInput => ({
    evidenceSource: 'structured',
    evidenceSubtype: 'classification',
    ...overrides,
  })

  it('maps structured frequency subtype correctly', () => {
    const item = makeItem({ evidenceSubtype: 'frequency' })

    expect(getSuggestionEvidenceType(item)).toBe('structured_frequency')
    expect(getSuggestionEvidenceLabel(item)).toBe('Frequencia estruturada')
    expect(getSuggestionEvidenceBadgeClass(item)).toBe('status-badge is-positive')
  })

  it('maps structured recurrence subtype correctly', () => {
    const item = makeItem({ evidenceSubtype: 'recurrence' })

    expect(getSuggestionEvidenceType(item)).toBe('structured_recurrence')
    expect(getSuggestionEvidenceLabel(item)).toBe('Recorrencia estruturada')
    expect(getSuggestionEvidenceBadgeClass(item)).toBe('status-badge is-neutral')
  })

  it('maps financial evidence correctly', () => {
    const item = makeItem({ evidenceSource: 'financial_goal', evidenceSubtype: null })

    expect(getSuggestionEvidenceType(item)).toBe('financial_goal')
    expect(getSuggestionEvidenceLabel(item)).toBe('Meta financeira')
    expect(getSuggestionEvidenceBadgeClass(item)).toBe('status-badge is-negative')
  })
})
