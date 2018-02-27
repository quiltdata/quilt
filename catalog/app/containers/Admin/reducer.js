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
  MEMBER_ADDED,
  GET_MEMBER_AUDIT,
  GET_MEMBER_AUDIT_RESPONSE,
  DISABLE_MEMBER_RESPONSE,
  ENABLE_MEMBER_RESPONSE,
  GET_PACKAGES,
  GET_PACKAGES_RESPONSE,
  GET_PACKAGE_AUDIT,
  GET_PACKAGE_AUDIT_RESPONSE,
} from './constants';

const initialState = fromJS({
  members: {
    status: null,
    response: null,
  },
  memberAudit: {
    name: null,
    status: null,
    response: null,
  },
  packages: {
    status: null,
    response: null,
  },
  packageAudit: {
    handle: null,
    status: null,
    response: null,
  },
});

const updateMember = (name, k, v) => (members) => {
  if (!members.findIndex) return members;
  const idx = members.findIndex((m) => m.get('name') === name);
  if (idx === -1) return members;
  return members.setIn([idx, k], v);
};

export default function adminReducer(state = initialState, action) {
  switch (action.type) {
    case MEMBER_ADDED:
      return state
        .updateIn(['members', 'response'], (members) =>
          members && members.push ? members.push(fromJS(action.member)) : members);
    case GET_MEMBERS:
      return state
        .setIn(['members', 'status'], api.WAITING)
        .setIn(['members', 'response'], null);
    case GET_MEMBERS_RESPONSE:
      return state
        .setIn(['members', 'status'], action.status)
        .setIn(['members', 'response'], fromJS(action.response));
    case GET_MEMBER_AUDIT:
      return state
        .setIn(['memberAudit', 'name'], action.name)
        .setIn(['memberAudit', 'status'], action.name && api.WAITING)
        .setIn(['memberAudit', 'response'], null);
    case GET_MEMBER_AUDIT_RESPONSE:
      return state
        .setIn(['memberAudit', 'status'], action.status)
        .setIn(['memberAudit', 'response'], fromJS(action.response));
    case DISABLE_MEMBER_RESPONSE:
      return action.status === api.ERROR
        ? state
        : state.updateIn(['members', 'response'], updateMember(action.name, 'status', 'disabled'));
    case ENABLE_MEMBER_RESPONSE:
      return action.status === api.ERROR
        ? state
        : state.updateIn(['members', 'response'], updateMember(action.name, 'status', 'active'));
    case GET_PACKAGES:
      return state
        .setIn(['packages', 'status'], api.WAITING)
        .setIn(['packages', 'response'], null);
    case GET_PACKAGES_RESPONSE:
      return state
        .setIn(['packages', 'status'], action.status)
        .setIn(['packages', 'response'], fromJS(action.response));
    case GET_PACKAGE_AUDIT:
      return state
        .setIn(['packageAudit', 'handle'], action.handle)
        .setIn(['packageAudit', 'status'], action.handle && api.WAITING)
        .setIn(['packageAudit', 'response'], null);
    case GET_PACKAGE_AUDIT_RESPONSE:
      return state
        .setIn(['packageAudit', 'status'], action.status)
        .setIn(['packageAudit', 'response'], fromJS(action.response));
    default:
      return state;
  }
}
