import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import {
  MenuImportAuditEvidenceBadge,
  MenuSuggestionEvidenceBadge,
} from './EvidenceBadges'

describe('EvidenceBadges component integration', () => {
  it('renders audit frequency badge label and class', () => {
    render(
      <MenuImportAuditEvidenceBadge evidence="Regra avaliada por frequencia estruturada: Fruta Citrica encontrado 2 vez(es) na semana." />,
    )

    const badge = screen.getByText('Frequencia estruturada')
    expect(badge.className).toContain('status-badge')
    expect(badge.className).toContain('is-positive')
  })

  it('renders audit recurrence badge label and class', () => {
    render(
      <MenuImportAuditEvidenceBadge evidence="Regra avaliada por recorrencia estruturada: Peixe reapareceu apos 3 dia(s), abaixo do minimo de 7 dias." />,
    )

    const badge = screen.getByText('Recorrencia estruturada')
    expect(badge.className).toContain('status-badge')
    expect(badge.className).toContain('is-neutral')
  })

  it('renders suggestion badge for structured recurrence subtype', () => {
    render(
      <MenuSuggestionEvidenceBadge
        item={{
          evidenceSource: 'structured',
          evidenceSubtype: 'recurrence',
        }}
      />,
    )

    const badge = screen.getByText('Recorrencia estruturada')
    expect(badge.className).toContain('status-badge')
    expect(badge.className).toContain('is-neutral')
  })

  it('renders suggestion badge for financial goal source', () => {
    render(
      <MenuSuggestionEvidenceBadge
        item={{
          evidenceSource: 'financial_goal',
          evidenceSubtype: null,
        }}
      />,
    )

    const badge = screen.getByText('Meta financeira')
    expect(badge.className).toContain('status-badge')
    expect(badge.className).toContain('is-negative')
  })
})
