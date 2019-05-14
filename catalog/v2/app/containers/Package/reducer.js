import { fromJS } from 'immutable';
import { combineReducers } from 'redux-immutable';
import { handleActions, withInitialState, unset, combine } from 'utils/reduxTools';

import api from 'constants/api';
import { push } from 'utils/immutableTools';

import { actions } from './constants';


const commentsInitial = {
  status: api.WAITING,
};

export default combineReducers({
  comments: withInitialState(fromJS(commentsInitial), handleActions({
    [actions.GET_COMMENTS]: combine({
      status: api.WAITING,
      response: unset,
    }),

    [actions.GET_COMMENTS_RESPONSE]: combine({
      status: (p) => p.status,
      response: (p) => fromJS(p.response),
    }),

    [actions.COMMENT_ADDED]: combine({
      response: (p) => push(fromJS(p)),
    }),
  })),
});
