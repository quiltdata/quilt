import { call, put, takeLatest } from 'redux-saga/effects';

import makeError from 'utils/error';
import request from 'utils/sagaRequest';

import {
  getSuccess,
  getError,
} from './actions';
import { actions } from './constants';

export function* get({ payload: { name } }) {
  if (!name) return;
  try {
    const response = yield call(request, `/audit/${name}/`);
    // eslint-disable-next-line object-curly-newline, camelcase
    const events = response.events.map(({ created, package_owner, package_name, type }) => ({
      time: created * 1000,
      // eslint-disable-next-line camelcase
      handle: `${package_owner}/${package_name}`,
      event: type.toLowerCase(),
    }));
    if (response.message) throw makeError(response.message);
    yield put(getSuccess(events));
  } catch (err) {
    yield put(getError(err));
  }
}

export default function* () {
  yield takeLatest(actions.GET, get);
}
