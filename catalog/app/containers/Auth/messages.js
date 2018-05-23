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
  signInInternalError: {
    id: `${scope}.signInInternalError`,
    defaultMessage: 'Error signing in. Please try again later.',
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
  errorInternal: {
    id: `${scope}.errorInternal`,
    defaultMessage: 'Unexpected error',
  },
  errorForbidden: {
    id: `${scope}.errorInternal`,
    defaultMessage: 'Authentication lost. Try signing in again.',
  },

  // SignUp
  signUpHeading: {
    id: `${scope}.SignUp.heading`,
    defaultMessage: 'Sign Up',
  },
  signUpUsernameLabel: {
    id: `${scope}.SignUp.usernameLabel`,
    defaultMessage: 'Username',
  },
  signUpUsernameRequired: {
    id: `${scope}.SignUp.usernameRequired`,
    defaultMessage: 'Enter a username',
  },
  signUpEmailLabel: {
    id: `${scope}.SignUp.emailLabel`,
    defaultMessage: 'Email',
  },
  signUpEmailRequired: {
    id: `${scope}.SignUp.emailRequired`,
    defaultMessage: 'Enter your email',
  },
  signUpPassLabel: {
    id: `${scope}.SignUp.passLabel`,
    defaultMessage: 'Password',
  },
  signUpPassRequired: {
    id: `${scope}.SignUp.passRequired`,
    defaultMessage: 'Enter a password',
  },
  signUpPassCheckLabel: {
    id: `${scope}.SignUp.passCheckLabel`,
    defaultMessage: 'Password check',
  },
  signUpPassCheckRequired: {
    id: `${scope}.SignUp.passCheckRequired`,
    defaultMessage: 'Enter the password again',
  },
  signUpPassCheckMatch: {
    id: `${scope}.SignUp.passCheckMatch`,
    defaultMessage: 'Passwords must match',
  },
  signUpSubmit: {
    id: `${scope}.SignUp.submit`,
    defaultMessage: 'Sign Up',
  },

  // SignIn
  signInHeading: {
    id: `${scope}.SignIn.heading`,
    defaultMessage: 'Sign In',
  },
  signInUsernameLabel: {
    id: `${scope}.SignIn.usernameLabel`,
    defaultMessage: 'Username',
  },
  signInUsernameRequired: {
    id: `${scope}.SignIn.usernameRequired`,
    defaultMessage: 'Enter your username',
  },
  signInPassLabel: {
    id: `${scope}.SignIn.passLabel`,
    defaultMessage: 'Password',
  },
  signInPassRequired: {
    id: `${scope}.SignIn.passRequired`,
    defaultMessage: 'Enter your password',
  },
  signInSubmit: {
    id: `${scope}.SignIn.submit`,
    defaultMessage: 'Sign In',
  },
});
