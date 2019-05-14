import { call, put, takeLatest } from 'redux-saga/effects';

import { apiRequest } from 'utils/APIConnector';
import { ErrorDisplay } from 'utils/error';
import { captureError } from 'utils/errorReporting';

import {
  getLatestError,
  getLatestSuccess,
} from './actions';

import { GET_LATEST } from './constants';


function* doGetLatest() {
  try {
    const response = yield call(apiRequest, '/recent_packages/');
    yield put(getLatestSuccess(response));
  } catch (e) {
    yield put(getLatestError(new ErrorDisplay(
      'Package hiccup', `doGetLatest: ${e.message}`
    )));
    captureError(e);
  }
}

export default function* () {
  yield takeLatest(GET_LATEST, doGetLatest);
}
