import { useEffect, useRef, useState, type FormEvent, type MouseEvent as ReactMouseEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { AppShell } from '../components/layout/AppShell'
import { useAuth } from '../auth'

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001'

type ContractItem = {
  id: string
  siteId?: string
  siteName?: string
  title: string
  sourceType: string
  status: string
  inactivationReason?: string | null
  createdAt: string
}

type ContractFormState = {
  title: string
  sourceType: 'contract' | 'bid_notice' | 'reference_term' | 'regulation'
  siteId: string
}

const sourceTypeLabels: Record<ContractFormState['sourceType'], string> = {
  contract: 'Contrato',
  bid_notice: 'Edital',
  reference_term: 'Termo Aditivo',
  regulation: 'Outro',
}

const statusLabel = (status: string) => {
  if (status === 'processing') {
    return 'Processando...'
  }

  if (status === 'rules_extracted') {
    return 'Regras extraídas'
  }

  if (status === 'inactive') {
    return 'Inativo'
  }

  if (status === 'extraction_failed') {
    return 'Falha na extração'
  }

  if (status === 'active') {
    return 'Ativo'
  }

  if (status === 'draft') {
    return 'Rascunho'
  }

  if (status === 'archived') {
    return 'Arquivado'
  }

  return status
}

const rulesStageLabel = (status: string) => {
  if (status === 'processing') {
    return 'Extraindo regras'
  }

  if (status === 'rules_extracted') {
    return 'Regras extraídas'
  }

  if (status === 'rules_validated' || status === 'active') {
    return 'Regras validadas'
  }

  if (status === 'extraction_failed') {
    return 'Falha na extração'
  }

  if (status === 'inactive') {
    return 'Contrato inativo'
  }

  return status
}

export function ContractsPage() {
  const { authState, logout } = useAuth()
  const navigate = useNavigate()
  const [contracts, setContracts] = useState<ContractItem[]>([])
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [actionMenuContractId, setActionMenuContractId] = useState<string | null>(null)
  const [actionMenuPosition, setActionMenuPosition] = useState<{ top: number; left: number } | null>(null)
  const [isInactivateModalOpen, setIsInactivateModalOpen] = useState(false)
  const [inactivateReason, setInactivateReason] = useState('')
  const [targetContract, setTargetContract] = useState<ContractItem | null>(null)
  const contractFileInputRef = useRef<HTMLInputElement | null>(null)
  const [selectedSiteId, setSelectedSiteId] = useState('')
  const [form, setForm] = useState<ContractFormState>({
    title: '',
    sourceType: 'contract',
    siteId: '',
  })
  const authorizedSites = authState?.authorizedSites ?? []
  const activeSiteId = form.siteId || (authorizedSites.length === 1 ? authorizedSites[0]?.id ?? '' : '')
  const listingSiteId = selectedSiteId || (authorizedSites.length === 1 ? authorizedSites[0]?.id ?? '' : '')

  const loadContracts = async (options?: { silent?: boolean }) => {
    if (!authState) {
      setContracts([])
      return
    }

    if (!listingSiteId) {
      setContracts([])
      setLoading(false)
      return
    }

    if (!options?.silent) {
      setLoading(true)
    }
    setError(null)

    try {
      const response = await fetch(`${API_URL}/contracts?siteId=${encodeURIComponent(listingSiteId)}`, {
        headers: { Authorization: `Bearer ${authState.token}` },
      })

      if (!response.ok) {
        throw new Error('Falha ao carregar contratos.')
      }

      const payload = (await response.json()) as { contracts?: ContractItem[] }
      setContracts(payload.contracts ?? [])
    } catch (loadError) {
      setContracts([])
      setError(loadError instanceof Error ? loadError.message : 'Falha ao carregar contratos.')
    } finally {
      if (!options?.silent) {
        setLoading(false)
      }
    }
  }

  useEffect(() => {
    void loadContracts()
  }, [authState, listingSiteId])

  useEffect(() => {
    if (!authState) {
      return
    }

    const hasProcessing = contracts.some((item) => item.status === 'processing')
    if (!hasProcessing) {
      return
    }

    const intervalId = window.setInterval(() => {
      void loadContracts({ silent: true })
    }, 5000)

    return () => window.clearInterval(intervalId)
  }, [authState, contracts])

  useEffect(() => {
    if (!actionMenuContractId) {
      return
    }

    const closeMenu = () => {
      setActionMenuContractId(null)
      setActionMenuPosition(null)
    }

    const handleOutsideClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null
      if (target?.closest('.mc-actions-menu') || target?.closest('.mc-actions-trigger')) {
        return
      }

      closeMenu()
    }

    document.addEventListener('mousedown', handleOutsideClick)
    window.addEventListener('resize', closeMenu)
    window.addEventListener('scroll', closeMenu, true)

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick)
      window.removeEventListener('resize', closeMenu)
      window.removeEventListener('scroll', closeMenu, true)
    }
  }, [actionMenuContractId])

  useEffect(() => {
    if (!successMessage) {
      return
    }

    const timeoutId = window.setTimeout(() => {
      setSuccessMessage(null)
    }, 4500)

    return () => window.clearTimeout(timeoutId)
  }, [successMessage])

  const handleCreateContract = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!authState) {
      return
    }

    setSubmitting(true)
    setError(null)
    setSuccessMessage(null)

    try {
      if (!activeSiteId) {
        throw new Error('Selecione uma unidade para criar o contrato.')
      }

      const formData = new FormData()
      formData.append('title', form.title.trim())
      formData.append('sourceType', form.sourceType)
      formData.append('siteId', activeSiteId)

      if (selectedFile) {
        formData.append('file', selectedFile)
      }

      const response = await fetch(`${API_URL}/contracts`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authState.token}`,
        },
        body: formData,
      })

      if (!response.ok) {
        throw new Error('Falha ao criar contrato.')
      }

      setForm({ title: '', sourceType: 'contract', siteId: '' })
      setSelectedFile(null)
      setIsCreateModalOpen(false)
      setSuccessMessage('Contrato criado — extraindo regras...')
      await loadContracts()
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Falha ao criar contrato.')
    } finally {
      setSubmitting(false)
    }
  }

  const statusClassName = (status: string) => {
    if (status === 'active') {
      return 'ok'
    }

    if (status === 'processing') {
      return 'warn'
    }

    if (status === 'rules_extracted') {
      return 'info'
    }

    if (status === 'inactive') {
      return 'muted'
    }

    return 'err'
  }

  const handleReactivate = async (contract: ContractItem) => {
    if (!authState) {
      return
    }

    setError(null)
    setSuccessMessage(null)

    try {
      const response = await fetch(`${API_URL}/contracts/${encodeURIComponent(contract.id)}/status`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${authState.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: 'active' }),
      })

      if (!response.ok) {
        throw new Error('Falha ao reativar contrato.')
      }

      setSuccessMessage('Contrato reativado com sucesso.')
      setActionMenuContractId(null)
      setActionMenuPosition(null)
      await loadContracts()
    } catch (reactivateError) {
      setError(reactivateError instanceof Error ? reactivateError.message : 'Falha ao reativar contrato.')
    }
  }

  const openInactivateModal = (contract: ContractItem) => {
    setTargetContract(contract)
    setInactivateReason('')
    setActionMenuContractId(null)
    setActionMenuPosition(null)
    setIsInactivateModalOpen(true)
  }

  const handleToggleActionMenu = (event: ReactMouseEvent<HTMLButtonElement>, contractId: string) => {
    if (actionMenuContractId === contractId) {
      setActionMenuContractId(null)
      setActionMenuPosition(null)
      return
    }

    const rect = event.currentTarget.getBoundingClientRect()
    setActionMenuContractId(contractId)
    setActionMenuPosition({ top: rect.bottom + 6, left: rect.right })
  }

  const handleInactivate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!authState || !targetContract) {
      return
    }

    setError(null)
    setSuccessMessage(null)

    try {
      const response = await fetch(`${API_URL}/contracts/${encodeURIComponent(targetContract.id)}/status`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${authState.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: 'inactive',
          inactivationReason: inactivateReason.trim(),
        }),
      })

      if (!response.ok) {
        throw new Error('Falha ao inativar contrato.')
      }

      setIsInactivateModalOpen(false)
      setTargetContract(null)
      setInactivateReason('')
      setSuccessMessage('Contrato inativado com sucesso.')
      await loadContracts()
    } catch (inactivateError) {
      setError(inactivateError instanceof Error ? inactivateError.message : 'Falha ao inativar contrato.')
    }
  }

  return (
    <AppShell onLogout={logout}>
      <section className="card mc-table-card">
        <div className="mc-card-head">
          <h2>Contratos</h2>
          <button
            type="button"
            className="mc-new-contract-btn"
            onClick={() => setIsCreateModalOpen(true)}
          >
            + Novo contrato
          </button>
        </div>

        {error ? <p className="auth-error">{error}</p> : null}

        {authorizedSites.length > 1 ? (
          <label className="mc-field-inline">
            Unidade
            <select
              value={selectedSiteId}
              onChange={(event) => setSelectedSiteId(event.target.value)}
            >
              <option value="" disabled>Selecione a unidade</option>
              {authorizedSites.map((site) => (
                <option key={site.id} value={site.id}>{site.name}</option>
              ))}
            </select>
          </label>
        ) : null}

        <table className="mc-clean-table mc-contracts-table">
          <thead>
            <tr>
              <th>Título</th>
              <th>Unidade</th>
              <th>Tipo de documento</th>
              <th>Status</th>
              <th>Estágio das regras</th>
              <th>Data de criação</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {!listingSiteId ? (
              <tr><td colSpan={7}>Selecione uma unidade para visualizar contratos.</td></tr>
            ) : loading ? (
              <tr><td colSpan={7}>Carregando contratos...</td></tr>
            ) : contracts.length ? contracts.map((contract) => (
                <tr key={contract.id}>
                  <td>{contract.title}</td>
                  <td>{contract.siteName ?? 'Unidade ativa'}</td>
                  <td>{sourceTypeLabels[(contract.sourceType as ContractFormState['sourceType'])] ?? contract.sourceType}</td>
                  <td>
                    <span
                      className={`mc-status ${statusClassName(contract.status)}`}
                    >
                      {statusLabel(contract.status)}
                    </span>
                  </td>
                  <td>
                    <span className={`mc-status ${statusClassName(contract.status)}`}>
                      {rulesStageLabel(contract.status)}
                    </span>
                  </td>
                  <td>{new Date(contract.createdAt).toLocaleDateString('pt-BR')}</td>
                  <td>
                    <div className="mc-actions-menu-wrap">
                      <button
                        type="button"
                        className="mc-icon-btn mc-actions-trigger"
                        onClick={(event) => handleToggleActionMenu(event, contract.id)}
                      >
                        ⋯
                      </button>
                    </div>
                  </td>
                </tr>
              )) : (
                <tr><td colSpan={7}>Nenhum contrato cadastrado.</td></tr>
              )}
          </tbody>
        </table>

        {actionMenuContractId && actionMenuPosition ? (
          <div
            className="mc-actions-menu mc-actions-menu-floating"
            style={{ top: `${actionMenuPosition.top}px`, left: `${actionMenuPosition.left}px` }}
          >
            <button
              type="button"
              onClick={() => {
                const selectedContract = contracts.find((item) => item.id === actionMenuContractId)
                if (!selectedContract) {
                  return
                }

                setActionMenuContractId(null)
                setActionMenuPosition(null)
                navigate(`/contracts/${selectedContract.id}/rules`)
              }}
            >
              Ver regras
            </button>
            {contracts.find((item) => item.id === actionMenuContractId)?.status !== 'inactive' ? (
              <button
                type="button"
                onClick={() => {
                  const selectedContract = contracts.find((item) => item.id === actionMenuContractId)
                  if (!selectedContract) {
                    return
                  }
                  openInactivateModal(selectedContract)
                }}
              >
                Inativar
              </button>
            ) : null}
            {contracts.find((item) => item.id === actionMenuContractId)?.status === 'inactive' ? (
              <button
                type="button"
                onClick={() => {
                  const selectedContract = contracts.find((item) => item.id === actionMenuContractId)
                  if (!selectedContract) {
                    return
                  }

                  setActionMenuContractId(null)
                  setActionMenuPosition(null)
                  void handleReactivate(selectedContract)
                }}
              >
                Reativar
              </button>
            ) : null}
          </div>
        ) : null}
      </section>

      {isCreateModalOpen ? (
        <div className="mc-modal-overlay" role="presentation" onClick={() => setIsCreateModalOpen(false)}>
          <div className="mc-modal" role="dialog" aria-modal="true" aria-labelledby="new-contract-title" onClick={(event) => event.stopPropagation()}>
            <h3 id="new-contract-title">Novo contrato</h3>
            <form className="mc-auth-form" onSubmit={handleCreateContract}>
              <label>
                Título
                <input
                  type="text"
                  value={form.title}
                  onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                  minLength={3}
                  required
                />
              </label>

              <label>
                Tipo de documento
                <select
                  value={form.sourceType}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      sourceType: event.target.value as ContractFormState['sourceType'],
                    }))
                  }
                >
                  <option value="contract">Contrato</option>
                  <option value="bid_notice">Edital</option>
                  <option value="reference_term">Termo Aditivo</option>
                  <option value="regulation">Outro</option>
                </select>
              </label>

              <label>
                Unidade
                <select
                  value={activeSiteId}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      siteId: event.target.value,
                    }))
                  }
                  required
                >
                  <option value="" disabled>Selecione a unidade</option>
                  {authorizedSites.map((site) => (
                    <option key={site.id} value={site.id}>{site.name}</option>
                  ))}
                </select>
              </label>

              <label>
                Contrato em PDF
                <input
                  ref={contractFileInputRef}
                  type="file"
                  accept="application/pdf"
                  hidden
                  onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
                />
                <button
                  type="button"
                  className="mc-modal-cancel"
                  onClick={() => contractFileInputRef.current?.click()}
                >
                  Selecionar arquivo
                </button>
              </label>
              <p className="mc-muted-text">{selectedFile ? selectedFile.name : 'Nenhum arquivo selecionado.'}</p>

              <div className="mc-modal-actions">
                <button type="button" className="mc-modal-cancel" onClick={() => setIsCreateModalOpen(false)}>
                  Cancelar
                </button>
                <button type="submit" className="mc-login-button" disabled={submitting}>
                  {submitting ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {isInactivateModalOpen ? (
        <div className="mc-modal-overlay" role="presentation" onClick={() => setIsInactivateModalOpen(false)}>
          <div className="mc-modal" role="dialog" aria-modal="true" aria-labelledby="inactivate-contract-title" onClick={(event) => event.stopPropagation()}>
            <h3 id="inactivate-contract-title">Inativar contrato</h3>
            <form className="mc-auth-form" onSubmit={handleInactivate}>
              <label>
                Motivo da inativação
                <textarea
                  value={inactivateReason}
                  onChange={(event) => setInactivateReason(event.target.value)}
                  minLength={3}
                  required
                />
              </label>
              <div className="mc-modal-actions">
                <button type="button" className="mc-modal-cancel" onClick={() => setIsInactivateModalOpen(false)}>
                  Cancelar
                </button>
                <button type="submit" className="mc-login-button">
                  Confirmar inativação
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {successMessage ? (
        <div className="mc-toast-stack" role="status" aria-live="polite">
          <div className="mc-toast mc-toast-success">{successMessage}</div>
        </div>
      ) : null}
    </AppShell>
  )
}
