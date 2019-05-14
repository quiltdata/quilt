import { createActions } from 'utils/reduxTools';

export const REDUX_KEY = 'app/Admin/Packages';

export const actions = createActions(REDUX_KEY,
  'GET',
  'GET_RESPONSE',
); // eslint-disable-line function-paren-newline
