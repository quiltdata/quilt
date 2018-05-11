import { call, put, takeLatest } from 'redux-saga/effects';

import config from 'constants/config';
import { makeHeaders } from 'containers/Auth/saga';
import { requestJSON } from 'utils/request';
import makeError from 'utils/error';

import {
  getPackagesError,
  getPackagesSuccess,
} from './actions';
import {
  GET_PACKAGES,
} from './constants';


export function* doGetPackages({ username }) {
  try {
    const headers = yield call(makeHeaders);
    const response = yield call(requestJSON,
      `${config.api}/api/package/${username}/`,
      { headers });
    if (response.status !== 200 || response.message) {
      throw makeError('Server hiccup', response.message, response);
    }
    yield put(getPackagesSuccess(response));
  } catch (err) {
    yield put(getPackagesError(err));
  }
}

export default function* () {
  yield takeLatest(GET_PACKAGES, doGetPackages);
}
