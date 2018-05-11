/* App reducer */
import { fromJS } from 'immutable';

import status from 'constants/api';

import {
  GET_LOG,
  GET_LOG_ERROR,
  GET_LOG_SUCCESS,
  GET_MANIFEST,
  GET_MANIFEST_ERROR,
  GET_MANIFEST_SUCCESS,
  GET_PACKAGE,
  GET_PACKAGE_ERROR,
  GET_PACKAGE_SUCCESS,
  GET_TRAFFIC,
  GET_TRAFFIC_RESPONSE,
  SET_SEARCH_TEXT,
  initialState,
} from './constants';

export default (state = initialState, action) => {
  switch (action.type) {
    case GET_LOG:
      return state.setIn(['package', 'log', 'status'], status.WAITING)
        .deleteIn(['package', 'log', 'error'])
        .deleteIn(['package', 'log', 'response']);
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
    case GET_TRAFFIC:
      return state.setIn(['package', 'traffic', 'status'], status.WAITING);
    case GET_TRAFFIC_RESPONSE:
      return state
        .setIn(['package', 'traffic', 'status'],
          action.error ? status.ERROR : status.SUCCESS)
        .setIn(['package', 'traffic', 'response'], fromJS(action.payload));
    case SET_SEARCH_TEXT:
      return state.setIn(['searchText'], action.text);
    default:
      return state;
  }
};
