import { fromJS } from 'immutable';
import { combineReducers } from 'redux-immutable';
import { handleActions, withInitialState, unset } from 'utils/reduxTools';

import api from 'constants/api';
import { push } from 'utils/immutableTools';

import { actions } from './constants';


const commentsInitial = {
  status: api.WAITING,
};

export default combineReducers({
  comments: withInitialState(fromJS(commentsInitial), handleActions({
    [actions.GET_COMMENTS]: {
      status: api.WAITING,
      response: unset,
    },

    [actions.GET_COMMENTS_RESPONSE]: {
      status: (p) => p.status,
      response: (p) => fromJS(p.response),
    },

    [actions.COMMENT_ADDED]: {
      response: (p) => push(fromJS(p)),
    },
  })),
});
