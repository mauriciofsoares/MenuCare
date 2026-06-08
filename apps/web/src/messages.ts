const uiMessagesByLocale = {
  'pt-BR': {
    auth: {
      sessionExpired: 'Sessao invalida ou expirada. Faca login novamente.',
      genericSignInError: 'Nao foi possivel entrar no portal.',
      validatingSessionTitle: 'Validando sessao...',
      validatingSessionText: 'Estamos conferindo se o acesso atual ainda e valido.',
      loginTitle: 'Acesso ao portal',
      loginTabLabel: 'Entrar',
      firstAccessTabLabel: 'Primeiro acesso',
      loginButton: 'Entrar no portal',
      loginLoadingButton: 'Entrando...',
      inviteTitle: 'Ativar acesso por convite',
      inviteTokenLabel: 'Codigo do convite',
      invitePasswordLabel: 'Defina sua senha',
      inviteButton: 'Ativar acesso',
      inviteLoadingButton: 'Ativando...',
      inviteSuccess:
        'Convite validado com sucesso. Agora use sua senha para entrar no portal.',
      adminInviteTitle: 'Gerar convite de primeiro acesso',
      adminInviteDescription:
        'Crie um codigo para novos usuarios ativarem senha no primeiro acesso.',
      adminInviteEmailLabel: 'Email do colaborador',
      adminInviteButton: 'Gerar convite',
      adminInviteLoadingButton: 'Gerando...',
      adminInviteTokenLabel: 'Codigo gerado',
      inviteHistoryTitle: 'Historico de convites',
      inviteFilterLabel: 'Filtro',
      inviteFilterAll: 'Todos',
      inviteFilterActive: 'Ativos',
      inviteFilterUsed: 'Inativos',
      inviteStatusActive: 'Ativo',
      inviteStatusInactive: 'Inativo',
      inviteCreatedAtLabel: 'Criado em',
      inviteUsedAtLabel: 'Inativado em',
      inviteRevokeButton: 'Revogar',
      inviteRegenerateButton: 'Regenerar',
      inviteLoadingHistory: 'Carregando convites...',
      inviteEmptyHistory: 'Nenhum convite encontrado para o filtro atual.',
      inviteAuditTitle: 'Rastreabilidade de acessos',
      inviteAuditLoading: 'Carregando auditoria de convites...',
      inviteAuditEmpty: 'Sem eventos de auditoria para convites.',
      inviteAuditActionGenerated: 'Gerado',
      inviteAuditActionRevoked: 'Revogado',
      inviteAuditActionRegenerated: 'Regenerado',
      inviteAuditActionActivated: 'Ativado',
      ruleStatusIdentified: 'Identificada',
      ruleStatusUnderReview: 'Em validacao',
      ruleStatusApproved: 'Aprovada',
      ruleStatusRejected: 'Rejeitada',
      ruleStatusArchived: 'Arquivada',
      activeSession: 'Sessao ativa em',
    },
    common: {
      languageLabel: 'Idioma',
      logoutButton: 'Sair',
      localeNames: {
        'pt-BR': 'Portugues (Brasil)',
        'en-US': 'English (US)',
      },
    },
  },
  'en-US': {
    auth: {
      sessionExpired: 'Session is invalid or expired. Please sign in again.',
      genericSignInError: 'Unable to access the portal right now.',
      validatingSessionTitle: 'Validating session...',
      validatingSessionText: 'We are checking if the current access is still valid.',
      loginTitle: 'Portal access',
      loginTabLabel: 'Sign in',
      firstAccessTabLabel: 'First access',
      loginButton: 'Sign in to portal',
      loginLoadingButton: 'Signing in...',
      inviteTitle: 'Activate access by invitation',
      inviteTokenLabel: 'Invitation code',
      invitePasswordLabel: 'Set your password',
      inviteButton: 'Activate access',
      inviteLoadingButton: 'Activating...',
      inviteSuccess:
        'Invitation validated successfully. Now use your password to access the portal.',
      adminInviteTitle: 'Generate first access invitation',
      adminInviteDescription:
        'Create a code for new users to activate their password at first access.',
      adminInviteEmailLabel: 'Collaborator email',
      adminInviteButton: 'Generate invitation',
      adminInviteLoadingButton: 'Generating...',
      adminInviteTokenLabel: 'Generated code',
      inviteHistoryTitle: 'Invitation history',
      inviteFilterLabel: 'Filter',
      inviteFilterAll: 'All',
      inviteFilterActive: 'Active',
      inviteFilterUsed: 'Inactive',
      inviteStatusActive: 'Active',
      inviteStatusInactive: 'Inactive',
      inviteCreatedAtLabel: 'Created at',
      inviteUsedAtLabel: 'Deactivated at',
      inviteRevokeButton: 'Revoke',
      inviteRegenerateButton: 'Regenerate',
      inviteLoadingHistory: 'Loading invitations...',
      inviteEmptyHistory: 'No invitations found for the selected filter.',
      inviteAuditTitle: 'Access traceability',
      inviteAuditLoading: 'Loading invitation audit events...',
      inviteAuditEmpty: 'No audit events found for invitations.',
      inviteAuditActionGenerated: 'Generated',
      inviteAuditActionRevoked: 'Revoked',
      inviteAuditActionRegenerated: 'Regenerated',
      inviteAuditActionActivated: 'Activated',
      ruleStatusIdentified: 'Identified',
      ruleStatusUnderReview: 'Under review',
      ruleStatusApproved: 'Approved',
      ruleStatusRejected: 'Rejected',
      ruleStatusArchived: 'Archived',
      activeSession: 'Active session at',
    },
    common: {
      languageLabel: 'Language',
      logoutButton: 'Sign out',
      localeNames: {
        'pt-BR': 'Portuguese (Brazil)',
        'en-US': 'English (US)',
      },
    },
  },
} as const;

export type UiLocale = keyof typeof uiMessagesByLocale;

export const resolveUiLocale = (locale?: string): UiLocale => {
  if (!locale) {
    return 'pt-BR';
  }

  const canonical = locale.trim();

  if (canonical in uiMessagesByLocale) {
    return canonical as UiLocale;
  }

  if (canonical.toLowerCase().startsWith('en')) {
    return 'en-US';
  }

  return 'pt-BR';
};

export const getSupportedUiLocales = (): UiLocale[] =>
  Object.keys(uiMessagesByLocale) as UiLocale[];

export const getUiMessage = (locale?: string) => {
  const selectedLocale = resolveUiLocale(locale);
  return uiMessagesByLocale[selectedLocale];
};
