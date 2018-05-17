import { call, put, takeLatest } from 'redux-saga/effects';

import config from 'constants/config';
import { makeHeaders } from 'containers/Auth/saga';
import makeError from 'utils/error';
import { requestJSON } from 'utils/request';

import {
  getLatestError,
  getLatestSuccess,
} from './actions';

import { GET_LATEST } from './constants';

function* doGetLatest() {
  try {
    const { api: server } = config;
    const endpoint = `${server}/api/recent_packages/`;
    const headers = yield call(makeHeaders);
    const response = yield call(requestJSON, endpoint, { method: 'GET', headers });

    if (response.message) {
      throw makeError('Package hiccup', response.message);
    }
    yield put(getLatestSuccess(response));
  } catch (err) {
    if (!err.headline) {
      err.headline = 'Package hiccup';
      err.detail = `doGetPackage: ${err.message}`;
    }
    yield put(getLatestError(err));
  }
}

export default function* () {
  yield takeLatest(GET_LATEST, doGetLatest);
}
