/* App reducer */
import { fromJS } from 'immutable';

import status from 'constants/api';

import {
  GET_LATEST,
  GET_LATEST_ERROR,
  GET_LATEST_SUCCESS,
} from './constants';


const iState = fromJS({});

function galleryReducer(state = iState, action) {
  switch (action.type) {
    case GET_LATEST:
      return state.setIn(['status'], status.WAITING)
        .deleteIn(['error'])
        .deleteIn(['response']);
    case GET_LATEST_ERROR:
      return state.setIn(['status'], status.ERROR)
        .setIn(['error'], fromJS(action.error))
        .deleteIn(['response']);
    case GET_LATEST_SUCCESS:
      return state.setIn(['status'], status.SUCCESS)
        .setIn(['response'], fromJS(action.response))
        .deleteIn(['error']);
    default:
      return state;
  }
}

export default galleryReducer;
