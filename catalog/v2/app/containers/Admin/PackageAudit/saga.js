import { call, put, takeLatest } from 'redux-saga/effects';

import { apiRequest } from 'utils/APIConnector';
import { captureError } from 'utils/errorReporting';

import {
  getSuccess,
  getError,
} from './actions';
import { actions } from './constants';


export function* get({ payload: { handle } }) {
  if (!handle) return;
  try {
    const response = yield call(apiRequest, `/audit/${handle}/`);
    const events = response.events.map(({ created, user, type }) => ({
      time: created * 1000,
      user,
      event: type.toLowerCase(),
    }));
    yield put(getSuccess(events));
  } catch (e) {
    yield put(getError(e));
    captureError(e);
  }
}

export default function* () {
  yield takeLatest(actions.GET, get);
}
