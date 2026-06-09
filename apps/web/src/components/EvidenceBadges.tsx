import {
  getMenuImportAuditEvidenceBadgeClass,
  getMenuImportAuditEvidenceLabel,
  getSuggestionEvidenceBadgeClass,
  getSuggestionEvidenceLabel,
  type SuggestionEvidenceInput,
} from '../evidence-badges'

type MenuImportAuditEvidenceBadgeProps = {
  evidence: string
}

type MenuSuggestionEvidenceBadgeProps = {
  item: SuggestionEvidenceInput
}

export const MenuImportAuditEvidenceBadge = ({ evidence }: MenuImportAuditEvidenceBadgeProps) => (
  <span className={getMenuImportAuditEvidenceBadgeClass(evidence)}>
    {getMenuImportAuditEvidenceLabel(evidence)}
  </span>
)

export const MenuSuggestionEvidenceBadge = ({ item }: MenuSuggestionEvidenceBadgeProps) => (
  <span className={getSuggestionEvidenceBadgeClass(item)}>{getSuggestionEvidenceLabel(item)}</span>
)
