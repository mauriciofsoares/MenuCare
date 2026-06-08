const apiMessagesByLocale = {
  'pt-BR': {
    auth: {
      sessionExpired: 'Sessao invalida ou expirada. Faca login novamente.',
      invalidCredentials: 'Credenciais invalidas.',
      wrongEmailOrPassword: 'Email ou senha incorretos.',
      tooManyLoginAttempts: 'Muitas tentativas de login. Tente novamente em alguns minutos.',
      signedOut: 'Sessao encerrada com sucesso.',
      invalidInvitePayload: 'Dados de primeiro acesso invalidos.',
      invalidOrExpiredInvite: 'Convite invalido ou expirado.',
      inviteActivated: 'Primeiro acesso ativado com sucesso.',
      inviteGenerated: 'Convite gerado com sucesso.',
      inviteNotFound: 'Convite nao encontrado para esta empresa.',
      inviteAlreadyInactive: 'Convite ja esta inativo.',
      inviteRevoked: 'Convite revogado com sucesso.',
    },
    preferences: {
      invalidLocale: 'Idioma informado e invalido.',
    },
    health: {
      serviceOk: 'Servico operacional.',
      dbUnavailable:
        'Prisma Client indisponivel. Execute prisma:generate para habilitar o check de banco.',
      dbConnected: 'Banco conectado.',
      dbDisconnected: 'Banco indisponivel.',
    },
  },
  'en-US': {
    auth: {
      sessionExpired: 'Session is invalid or expired. Please sign in again.',
      invalidCredentials: 'Invalid credentials.',
      wrongEmailOrPassword: 'Incorrect email or password.',
      tooManyLoginAttempts: 'Too many login attempts. Please try again in a few minutes.',
      signedOut: 'Session ended successfully.',
      invalidInvitePayload: 'First access payload is invalid.',
      invalidOrExpiredInvite: 'Invitation is invalid or expired.',
      inviteActivated: 'First access activated successfully.',
      inviteGenerated: 'Invitation generated successfully.',
      inviteNotFound: 'Invitation was not found for this company.',
      inviteAlreadyInactive: 'Invitation is already inactive.',
      inviteRevoked: 'Invitation revoked successfully.',
    },
    preferences: {
      invalidLocale: 'Provided locale is invalid.',
    },
    health: {
      serviceOk: 'Service is operational.',
      dbUnavailable:
        'Prisma Client is unavailable. Run prisma:generate to enable database checks.',
      dbConnected: 'Database connected.',
      dbDisconnected: 'Database unavailable.',
    },
  },
} as const;

export type ApiLocale = keyof typeof apiMessagesByLocale;

const normalizeLocale = (locale?: string): ApiLocale => {
  if (!locale) {
    return 'pt-BR';
  }

  const canonical = locale.trim();

  if (canonical in apiMessagesByLocale) {
    return canonical as ApiLocale;
  }

  if (canonical.toLowerCase().startsWith('en')) {
    return 'en-US';
  }

  return 'pt-BR';
};

export const getApiMessage = (locale?: string) => {
  const selectedLocale = normalizeLocale(locale);
  return apiMessagesByLocale[selectedLocale];
};
