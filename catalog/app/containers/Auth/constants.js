import { createActions } from 'utils/reduxTools';

export const REDUX_KEY = 'app/Auth';

export const states = [
  'SIGNED_OUT',
  'SIGNING_IN',
  'SIGNED_IN',
  'REFRESHING',
];

export const waitingStates = [
  'SIGNING_IN',
  'REFRESHING',
];

export const actions = createActions(REDUX_KEY,
  'SIGN_UP',
  'SIGN_IN',
  'SIGN_IN_SUCCESS',
  'SIGN_IN_ERROR',
  'SIGN_OUT',
  'CHECK',
  'REFRESH',
  'REFRESH_SUCCESS',
  'REFRESH_ERROR',
  'AUTH_LOST',
); // eslint-disable-line function-paren-newline

// DEBUG - 10 second expiry
// export const LATENCY_SECONDS = 35990;
export const LATENCY_SECONDS = 20;

export const ERROR_NOTIFICATION_TTL = 20000;
export const ERROR_REDIRECT_PATH = '/';
