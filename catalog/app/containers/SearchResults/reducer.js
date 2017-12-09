/* reducer for SearchResults */
import { fromJS } from 'immutable';

import status from 'constants/api';

import {
  GET_SEARCH,
  GET_SEARCH_ERROR,
  GET_SEARCH_SUCCESS,
} from './constants';

const initialState = fromJS({});

function searchReducer(state = initialState, action) {
  switch (action.type) {
    case GET_SEARCH:
      return state.setIn(['status'], status.WAITING)
        .setIn(['query'], action.query)
        .deleteIn(['error'])
        .deleteIn(['response']);
    case GET_SEARCH_ERROR:
      return state.setIn(['status'], status.ERROR)
        .setIn(['error'], action.error);
    case GET_SEARCH_SUCCESS:
      return state.setIn(['status'], status.SUCCESS)
        .setIn(['response'], action.response);
    default:
      return state;
  }
}

export default searchReducer;
