/* App reducer */
import { LOCATION_CHANGE } from 'react-router-redux';
import { fromJS } from 'immutable';

import status from 'constants/api';

import {
  GET_AUTH,
  GET_AUTH_ERROR,
  GET_AUTH_SUCCESS,
  GET_LOG,
  GET_LOG_ERROR,
  GET_LOG_SUCCESS,
  GET_MANIFEST,
  GET_MANIFEST_ERROR,
  GET_MANIFEST_SUCCESS,
  GET_PACKAGE,
  GET_PACKAGE_ERROR,
  GET_PACKAGE_SUCCESS,
  NO_OP,
  REFRESH_AUTH,
  ROUTER_START,
  SET_SEARCH_TEXT,
  SIGN_OUT,
  STORE_TOKENS,
  initialState,
} from './constants';

function appReducer(state = initialState, action) {
  switch (action.type) {
    case GET_AUTH:
    case REFRESH_AUTH:
      return state.setIn(['user', 'auth', 'status'], status.WAITING)
        .deleteIn(['user', 'auth', 'error'])
        .deleteIn(['user', 'auth', 'response']);
    case GET_AUTH_ERROR:
      return state.setIn(['user', 'auth', 'status'], status.ERROR)
        .setIn(['user', 'auth', 'error'], fromJS(action.error));
    case GET_AUTH_SUCCESS:
      return state.setIn(['user', 'auth', 'status'], status.SUCCESS)
        .setIn(['user', 'auth', 'response'], fromJS(action.response));
    case GET_LOG:
      return state.setIn(['package', 'log', 'status'], status.WAITING)
        .deleteIn(['package', 'log', 'error'])
        .deleteIn(['package', 'log', 'response'])
    case GET_LOG_ERROR:
      return state.setIn(['package', 'log', 'status'], status.ERROR)
        .setIn(['package', 'log', 'error'], fromJS(action.error));
    case GET_LOG_SUCCESS:
      return state.setIn(['package', 'log', 'status'], status.SUCCESS)
        .setIn(['package', 'log', 'response'], fromJS(action.response));
    case GET_MANIFEST:
      return state.setIn(['package', 'manifest', 'status'], status.WAITING)
        .deleteIn(['package', 'manifest', 'error'])
        .deleteIn(['package', 'manifest', 'response']);
    case GET_MANIFEST_ERROR:
      return state.setIn(['package', 'manifest', 'status'], status.ERROR)
        .setIn(['package', 'manifest', 'error'], fromJS(action.error));
    case GET_MANIFEST_SUCCESS:
      return state.setIn(['package', 'manifest', 'status'], status.SUCCESS)
        .setIn(['package', 'manifest', 'response'], fromJS(action.response));
    case GET_PACKAGE:
      return state.setIn(['package', 'status'], status.WAITING)
        .setIn(['package', 'name'], action.name)
        .deleteIn(['package', 'error'])
        .deleteIn(['package', 'response']);
    case GET_PACKAGE_ERROR:
      return state.setIn(['package', 'status'], status.ERROR)
        .setIn(['package', 'error'], fromJS(action.error));
    case GET_PACKAGE_SUCCESS:
      return state.setIn(['package', 'status'], status.SUCCESS)
        .setIn(['package', 'response'], fromJS(action.response));
    case LOCATION_CHANGE:
    case ROUTER_START:
      return state.set('location', fromJS(action.location || action.payload));
    case SET_SEARCH_TEXT:
      return state.setIn(['searchText'], action.text);
    case SIGN_OUT:
      return state.deleteIn(['user', 'auth', 'tokens'])
        .deleteIn(['user', 'auth', 'response']);
    case STORE_TOKENS:
      return state.setIn(['user', 'auth', 'tokens'], fromJS(action.response));
    case NO_OP:
    default:
      return state;
  }
}

export default appReducer;
