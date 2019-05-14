import { call, put, takeLatest } from 'redux-saga/effects';

import { apiRequest } from 'utils/APIConnector';
import { ErrorDisplay } from 'utils/error';
import { captureError } from 'utils/errorReporting';

import {
  getPackagesError,
  getPackagesSuccess,
} from './actions';
import {
  GET_PACKAGES,
} from './constants';


export function* doGetPackages({ username }) {
  try {
    const response = yield call(apiRequest, `/package/${username}/`);
    yield put(getPackagesSuccess(response));
  } catch (err) {
    yield put(getPackagesError(new ErrorDisplay(
      'Server hiccup', err.message
    )));
    captureError(err);
  }
}

export default function* () {
  yield takeLatest(GET_PACKAGES, doGetPackages);
}
