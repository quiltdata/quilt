import { defineMessages } from 'react-intl';

const scope = 'app.containers.Auth';

export default defineMessages({
  // Wrapper
  wrapperFailureHeading: {
    id: `${scope}.Wrapper.Failure.heading`,
    defaultMessage: 'Error signing in',
  },
  wrapperFailureDescription: {
    id: `${scope}.Wrapper.Failure.description`,
    defaultMessage: 'Something went wrong. Try again.',
  },
  wrapperFailureRetry: {
    id: `${scope}.Wrapper.Failure.retry`,
    defaultMessage: 'Retry',
  },

  // SignUp
  signUpHeading: {
    id: `${scope}.SignUp.heading`,
    defaultMessage: 'Sign Up',
  },
  signUpPassResetHint: {
    id: `${scope}.SignUp.passResetHint`,
    defaultMessage: "Dont't remember your password?",
  },
  signUpUsernameLabel: {
    id: `${scope}.SignUp.usernameLabel`,
    defaultMessage: 'Username',
  },
  signUpUsernameRequired: {
    id: `${scope}.SignUp.usernameRequired`,
    defaultMessage: 'Enter a username',
  },
  signUpUsernameTaken: {
    id: `${scope}.SignUp.usernameTaken`,
    defaultMessage: 'This username is already taken. {link}',
  },
  signUpUsernameInvalid: {
    id: `${scope}.SignUp.usernameInvalid`,
    // TODO: specify username requirements
    defaultMessage: 'This username is invalid',
  },
  signUpEmailLabel: {
    id: `${scope}.SignUp.emailLabel`,
    defaultMessage: 'Email',
  },
  signUpEmailRequired: {
    id: `${scope}.SignUp.emailRequired`,
    defaultMessage: 'Enter your email',
  },
  signUpEmailTaken: {
    id: `${scope}.SignUp.emailTaken`,
    defaultMessage: "This email is already taken. {link}",
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

  // SignOut
  signOutWaiting: {
    id: `${scope}.SignOut.waiting`,
    defaultMessage: 'Signing out',
  },

  // PassReset
  passResetHeading: {
    id: `${scope}.PassReset.heading`,
    defaultMessage: 'Reset Password',
  },
  passResetEmailLabel: {
    id: `${scope}.PassReset.emailLabel`,
    defaultMessage: 'Email',
  },
  passResetEmailRequired: {
    id: `${scope}.PassReset.emailRequired`,
    defaultMessage: 'Enter your email',
  },
  passResetSubmit: {
    id: `${scope}.PassReset.submit`,
    defaultMessage: 'Reset',
  },

  // PassChange
  passChangeHeading: {
    id: `${scope}.PassChange.heading`,
    defaultMessage: 'Change Password',
  },
  passChangePassLabel: {
    id: `${scope}.PassChange.passLabel`,
    defaultMessage: 'New password',
  },
  passChangePassRequired: {
    id: `${scope}.PassChange.passRequired`,
    defaultMessage: 'Enter a password',
  },
  passChangePassCheckLabel: {
    id: `${scope}.PassChange.passCheckLabel`,
    defaultMessage: 'Re-enter your new password',
  },
  passChangePassCheckRequired: {
    id: `${scope}.PassChange.passCheckRequired`,
    defaultMessage: 'Enter the password again',
  },
  passChangePassCheckMatch: {
    id: `${scope}.PassChange.passCheckMatch`,
    defaultMessage: 'Passwords must match',
  },
  passChangeSubmit: {
    id: `${scope}.PassChange.submit`,
    defaultMessage: 'Change Password',
  },
});
