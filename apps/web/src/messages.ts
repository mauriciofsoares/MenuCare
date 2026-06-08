const uiMessagesByLocale = {
  'pt-BR': {
    auth: {
      sessionExpired: 'Sessao invalida ou expirada. Faca login novamente.',
      genericSignInError: 'Nao foi possivel entrar no portal.',
      validatingSessionTitle: 'Validando sessao...',
      validatingSessionText: 'Estamos conferindo se o acesso atual ainda e valido.',
      loginTitle: 'Acesso ao portal',
      loginButton: 'Entrar no portal',
      loginLoadingButton: 'Entrando...',
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
      loginButton: 'Sign in to portal',
      loginLoadingButton: 'Signing in...',
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
