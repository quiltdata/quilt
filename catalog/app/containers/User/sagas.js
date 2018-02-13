import { call, put, takeLatest } from 'redux-saga/effects';
import { requestJSON } from 'utils/request';
import { makeHeaders } from 'utils/auth';
import makeError from 'utils/error';
import config from 'constants/config';
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
    // eslint-disable-next-line function-paren-newline
    const response = yield call(requestJSON,
      `${config.api}/api/package/${username}/`,
      { headers }
    );
    if (response.status !== 200 || response.message) {
      throw makeError('Server hiccup', response.message, response);
    }
    yield put(getPackagesSuccess(response));
  } catch (err) {
    yield put(getPackagesError(err));
  }
}

export function* watchGetPackages() {
  yield takeLatest(GET_PACKAGES, doGetPackages);
}


export default [
  watchGetPackages,
];
