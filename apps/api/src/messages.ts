const apiMessagesByLocale = {
  'pt-BR': {
    auth: {
      sessionExpired: 'Sessao invalida ou expirada. Faca login novamente.',
      invalidCredentials: 'Credenciais invalidas.',
      wrongEmailOrPassword: 'Email ou senha incorretos.',
      signedOut: 'Sessao encerrada com sucesso.',
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
      signedOut: 'Session ended successfully.',
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
