export type SuggestionEvidenceSource =
  | 'structured'
  | 'textual_fallback'
  | 'financial_goal'
  | 'preventive'

export type SuggestionEvidenceSubtype = 'frequency' | 'recurrence' | 'classification' | null

export type SuggestionEvidenceInput = {
  evidenceSource: SuggestionEvidenceSource
  evidenceSubtype: SuggestionEvidenceSubtype
}

export const getMenuImportAuditEvidenceType = (evidence: string) => {
  if (/frequencia estruturada/i.test(evidence)) {
    return 'structured_frequency' as const
  }

  if (/recorrencia estruturada/i.test(evidence)) {
    return 'structured_recurrence' as const
  }

  if (/classificacao estruturada/i.test(evidence)) {
    return 'structured_classification' as const
  }

  if (/fallback/i.test(evidence) || /evidencia textual/i.test(evidence)) {
    return 'textual_fallback' as const
  }

  return 'no_evidence' as const
}

export const getMenuImportAuditEvidenceLabel = (evidence: string) => {
  const evidenceType = getMenuImportAuditEvidenceType(evidence)

  if (evidenceType === 'structured_frequency') {
    return 'Frequencia estruturada'
  }

  if (evidenceType === 'structured_recurrence') {
    return 'Recorrencia estruturada'
  }

  if (evidenceType === 'structured_classification') {
    return 'Evidencia estruturada'
  }

  if (evidenceType === 'textual_fallback') {
    return 'Fallback textual'
  }

  return 'Sem evidencia'
}

export const getMenuImportAuditEvidenceBadgeClass = (evidence: string) => {
  const evidenceType = getMenuImportAuditEvidenceType(evidence)

  if (evidenceType === 'structured_frequency') {
    return 'status-badge is-positive'
  }

  if (evidenceType === 'structured_recurrence') {
    return 'status-badge is-neutral'
  }

  if (evidenceType === 'structured_classification') {
    return 'status-badge is-positive'
  }

  if (evidenceType === 'textual_fallback') {
    return 'status-badge is-progress'
  }

  return 'status-badge is-muted'
}

export const getSuggestionEvidenceType = (item: SuggestionEvidenceInput) => {
  if (item.evidenceSource === 'structured') {
    if (item.evidenceSubtype === 'frequency') {
      return 'structured_frequency' as const
    }

    if (item.evidenceSubtype === 'recurrence') {
      return 'structured_recurrence' as const
    }

    return 'structured' as const
  }

  return item.evidenceSource
}

export const getSuggestionEvidenceLabel = (item: SuggestionEvidenceInput) => {
  const evidenceType = getSuggestionEvidenceType(item)

  if (evidenceType === 'structured_frequency') {
    return 'Frequencia estruturada'
  }

  if (evidenceType === 'structured_recurrence') {
    return 'Recorrencia estruturada'
  }

  if (evidenceType === 'structured') {
    return 'Evidencia estruturada'
  }

  if (evidenceType === 'textual_fallback') {
    return 'Fallback textual'
  }

  if (evidenceType === 'financial_goal') {
    return 'Meta financeira'
  }

  return 'Otimizacao preventiva'
}

export const getSuggestionEvidenceBadgeClass = (item: SuggestionEvidenceInput) => {
  const evidenceType = getSuggestionEvidenceType(item)

  if (evidenceType === 'structured_frequency') {
    return 'status-badge is-positive'
  }

  if (evidenceType === 'structured_recurrence') {
    return 'status-badge is-neutral'
  }

  if (evidenceType === 'structured') {
    return 'status-badge is-positive'
  }

  if (evidenceType === 'textual_fallback') {
    return 'status-badge is-progress'
  }

  if (evidenceType === 'financial_goal') {
    return 'status-badge is-negative'
  }

  return 'status-badge is-neutral'
}
