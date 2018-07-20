import { call, put, takeLatest } from 'redux-saga/effects';

import { apiRequest } from 'utils/APIConnector';
import { captureError } from 'utils/errorReporting';

import {
  getSuccess,
  getError,
} from './actions';
import { actions } from './constants';


export function* get({ payload: { name } }) {
  if (!name) return;
  try {
    const response = yield call(apiRequest, `/audit/${name}/`);
    // eslint-disable-next-line object-curly-newline, camelcase
    const events = response.events.map(({ created, package_owner, package_name, type }) => ({
      time: created * 1000,
      // eslint-disable-next-line camelcase
      handle: `${package_owner}/${package_name}`,
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
