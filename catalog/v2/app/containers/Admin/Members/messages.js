import { defineMessages } from 'react-intl';

const scope = 'app.containers.Admin.Members';

export default defineMessages({
  heading: {
    id: `${scope}.heading`,
    defaultMessage: 'Members',
  },
  disableConfirm: {
    id: `${scope}.disableConfirm`,
    defaultMessage: 'Are you sure you want to disable user {name}?',
  },
  disableSuccess: {
    id: `${scope}.disableSuccess`,
    defaultMessage: 'User {name} has been disabled',
  },
  disableError: {
    id: `${scope}.disableError`,
    defaultMessage: 'Error disabling user {name}',
  },
  enableSuccess: {
    id: `${scope}.enableSuccess`,
    defaultMessage: 'User {name} has been enabled',
  },
  enableError: {
    id: `${scope}.enableError`,
    defaultMessage: 'Error enabling user {name}',
  },
  resetPasswordSuccess: {
    id: `${scope}.resetPasswordSuccess`,
    defaultMessage: 'Password for user {name} has been reset',
  },
  resetPasswordError: {
    id: `${scope}.resetPasswordError`,
    defaultMessage: 'Error resetting password for user {name}',
  },
  name: {
    id: `${scope}.name`,
    defaultMessage: 'Username',
  },
  activity: {
    id: `${scope}.activity`,
    defaultMessage: 'Activity',
  },
  lastSeen: {
    id: `${scope}.lastSeen`,
    defaultMessage: 'Last seen',
  },
  empty: {
    id: `${scope}.empty`,
    defaultMessage: 'No one here yet',
  },
  disabled: {
    id: `${scope}.disabled`,
    defaultMessage: 'disabled',
  },
  disable: {
    id: `${scope}.disable`,
    defaultMessage: 'Disable user',
  },
  enable: {
    id: `${scope}.enable`,
    defaultMessage: 'Enable user',
  },
  resetPassword: {
    id: `${scope}.resetPassword`,
    defaultMessage: 'Reset password',
  },
  addHeading: {
    id: `${scope}.Add.heading`,
    defaultMessage: 'Add member',
  },
  addFormErrorUniq: {
    id: `${scope}.Add.formErrorUniq`,
    defaultMessage: 'Username or email already taken',
  },
  addFormErrorUsername: {
    id: `${scope}.Add.formErrorUsername`,
    defaultMessage: 'Username must start with a letter or underscore, and contain only alphanumeric characters and underscores',
  },
  addUsername: {
    id: `${scope}.Add.username`,
    defaultMessage: 'Username',
  },
  addUsernameRequired: {
    id: `${scope}.Add.usernameRequired`,
    defaultMessage: 'Enter a username',
  },
  addUsernameInvalid: {
    id: `${scope}.Add.usernameInvalid`,
    defaultMessage: 'Enter a valid username',
  },
  addEmail: {
    id: `${scope}.Add.email`,
    defaultMessage: 'Email',
  },
  addEmailRequired: {
    id: `${scope}.Add.emailRequired`,
    defaultMessage: 'Enter an email address',
  },
  addEmailInvalid: {
    id: `${scope}.Add.emailInvalid`,
    defaultMessage: 'Enter a valid email',
  },
  addSubmit: {
    id: `${scope}.Add.submit`,
    defaultMessage: 'Add',
  },
  addSuccess: {
    id: `${scope}.Add.success`,
    defaultMessage: 'User {name} ({email}) invited',
  },
});
