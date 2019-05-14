/* Profile reducer */
import { fromJS } from 'immutable';

import status from 'constants/api';

import {
  GET_PROFILE,
  GET_PROFILE_ERROR,
  GET_PROFILE_SUCCESS,
  UPDATE_PAYMENT,
  UPDATE_PAYMENT_ERROR,
  UPDATE_PAYMENT_SUCCESS,
  UPDATE_PLAN,
  UPDATE_PLAN_ERROR,
  UPDATE_PLAN_SUCCESS,
} from './constants';

const initialState = fromJS({});

function profileReducer(state = initialState, action) {
  switch (action.type) {
    case GET_PROFILE:
      return state.setIn(['status'], status.WAITING)
        .setIn(['plan', 'status'], status.WAITING)
        .deleteIn(['error'])
        .deleteIn(['plan', 'response'])
        .deleteIn(['plan', 'error'])
        .deleteIn(['response']);
    case GET_PROFILE_ERROR:
      return state.setIn(['status'], status.ERROR)
        .setIn(['error'], fromJS(action.error));
    case GET_PROFILE_SUCCESS:
      return state.setIn(['status'], status.SUCCESS)
        .setIn(['response'], fromJS(action.response))
        .setIn(['plan', 'response'], action.response.plan)
        .setIn(['plan', 'status'], status.SUCCESS);
    case UPDATE_PAYMENT:
      return state.setIn(['payment', 'status'], status.WAITING)
        .deleteIn(['payment', 'error'])
        .deleteIn(['payment', 'response']);
    case UPDATE_PAYMENT_ERROR:
      return state.setIn(['payment', 'status'], status.ERROR)
        .setIn(['payment', 'error'], fromJS(action.error));
    case UPDATE_PAYMENT_SUCCESS:
      return state.setIn(['payment', 'status'], status.SUCCESS)
        .setIn(['payment', 'response'], fromJS(action.response));
    case UPDATE_PLAN:
      return state.setIn(['plan', 'status'], status.WAITING)
        // don't delete plan.response else UI dropdown goes blank
        .deleteIn(['plan', 'error']);
    case UPDATE_PLAN_ERROR:
      return state.setIn(['plan', 'status'], status.ERROR)
        .setIn(['plan', 'error'], fromJS(action.error));
    case UPDATE_PLAN_SUCCESS:
      return state.setIn(['plan', 'status'], status.SUCCESS)
        .setIn(['plan', 'response'], fromJS(action.response.plan));
    default:
      return state;
  }
}

export default profileReducer;
