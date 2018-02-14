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
  GET_PACKAGES,
  GET_PACKAGES_RESPONSE,
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
    case GET_PACKAGES:
      return state
        .setIn(['packages', 'status'], api.WAITING)
        .deleteIn(['packages', 'response']);
    case GET_PACKAGES_RESPONSE:
      return state
        .setIn(['packages', 'status'], action.status)
        .setIn(['packages', 'response'], fromJS(action.response));
    default:
      return state;
  }
};
