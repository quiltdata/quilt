import { call, put, takeLatest } from 'redux-saga/effects';

import request from 'utils/sagaRequest';

import {
  getSuccess,
  getError,
} from './actions';
import { actions } from './constants';

export function* get({ payload: { handle } }) {
  if (!handle) return;
  try {
    const response = yield call(request, `/audit/${handle}/`);
    const events = response.events.map(({ created, user, type }) => ({
      time: created * 1000,
      user,
      event: type.toLowerCase(),
    }));
    yield put(getSuccess(events));
  } catch (err) {
    yield put(getError(err));
  }
}

export default function* () {
  yield takeLatest(actions.GET, get);
}
