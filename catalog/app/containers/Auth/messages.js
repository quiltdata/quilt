import { defineMessages } from 'react-intl';

const scope = 'app.containers.Auth';

export default defineMessages({
  signingIn: {
    id: `${scope}.signingIn`,
    defaultMessage: 'Authenticating...',
  },
  signingOut: {
    id: `${scope}.signingOut`,
    defaultMessage: 'Signing out...',
  },
  signInError: {
    id: `${scope}.signInError`,
    defaultMessage: 'Error signing in',
  },
  signInRetry: {
    id: `${scope}.signInRetry`,
    defaultMessage: 'Retry',
  },
  authLost: {
    id: `${scope}.authLost`,
    defaultMessage: 'Authentication lost',
  },
  error: {
    id: `${scope}.error`,
    defaultMessage: 'Authentication error',
  },
  errorTry: {
    id: `${scope}.errorTry`,
    defaultMessage: 'Try {link} again',
  },
  errorTryLink: {
    id: `${scope}.errorTryLink`,
    defaultMessage: 'signing in',
  },
});
