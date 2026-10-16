import { createActions } from 'utils/reduxTools'

export const REDUX_KEY = 'app/Auth'

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
  'GET_TOKENS',
  'REFRESH',
  'REFRESH_RESULT',
  'AUTH_LOST',
  'GET_CODE',
  // quilt-specs changes/access-code-signup#catalog-work
  'GET_SIGNUP_PAGE',
  'CODE_SIGNUP_REDEEM',
  'CODE_SIGNUP_COMPLETE',
)
