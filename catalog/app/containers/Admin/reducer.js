/*
 *
 * Admin reducer
 *
 */

import { fromJS } from 'immutable';
import api from 'constants/api';
import {
  GET_MEMBERS,
  GET_MEMBERS_RESPONSE,
} from './constants';

const initialState = fromJS({
  members: {
    status: null,
    response: null,
  },
  packages: {},
});

export default function adminReducer(state = initialState, action) {
  switch (action.type) {
    case GET_MEMBERS:
      return state
        .setIn(['members', 'status'], api.WAITING)
        .deleteIn(['members', 'response']);
    case GET_MEMBERS_RESPONSE:
      return state
        .setIn(['members', 'status'], action.status)
        .setIn(['members', 'response'], fromJS(action.response));
    default:
      return state;
  }
};
