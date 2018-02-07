import { fromJS } from 'immutable';
import status from 'constants/api';
import {
  GET_PACKAGES,
  GET_PACKAGES_ERROR,
  GET_PACKAGES_SUCCESS,
} from './constants';


const initialState = fromJS({});

export default function userReducer(state = initialState, action) {
  switch (action.type) {
    case GET_PACKAGES:
      return state
        .set('status', status.WAITING)
        .delete('response');
    case GET_PACKAGES_ERROR:
      return state
        .set('status', status.ERROR)
        .set('response', fromJS(action.error));
    case GET_PACKAGES_SUCCESS:
      return state
        .set('status', status.SUCCESS)
        .set('response', fromJS(action.response));
    default:
      return state;
  }
}
