import { createActions } from 'utils/reduxTools'

export const REDUX_KEY = 'app/Auth'

export const states = ['SIGNED_OUT', 'SIGNING_IN', 'SIGNED_IN', 'REFRESHING']

export const waitingStates = ['SIGNING_IN', 'REFRESHING']

export const actions = createActions(
  REDUX_KEY,
  'SIGN_UP',
  'RESET_PASSWORD',
  'CHANGE_PASSWORD',
  'SIGN_IN',
  'SIGN_IN_RESULT',
  'SIGN_OUT',
  'SIGN_OUT_RESULT',
  'CHECK',
  'REFRESH',
  'REFRESH_RESULT',
  'AUTH_LOST',
  'GET_CODE',
) // eslint-disable-line function-paren-newline
