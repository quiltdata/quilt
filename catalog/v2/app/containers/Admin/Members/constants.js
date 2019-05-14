import { createActions } from 'utils/reduxTools';

export const REDUX_KEY = 'app/Admin/Members';

export const actions = createActions(REDUX_KEY,
  'ADD',
  'ADDED',
  'GET',
  'GET_RESPONSE',
  'DISABLE',
  'DISABLE_RESPONSE',
  'ENABLE',
  'ENABLE_RESPONSE',
  'RESET_PASSWORD',
  'RESET_PASSWORD_RESPONSE',
); // eslint-disable-line function-paren-newline
