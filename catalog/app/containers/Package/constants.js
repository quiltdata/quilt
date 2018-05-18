import { createActions } from 'utils/reduxTools';

export const REDUX_KEY = 'app/Package';

export const actions = createActions(REDUX_KEY,
  'GET_COMMENTS',
  'GET_COMMENTS_RESPONSE',
  'ADD_COMMENT',
  'COMMENT_ADDED',
); // eslint-disable-line function-paren-newline
