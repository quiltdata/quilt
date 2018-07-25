/* App sagas */
import { LOCATION_CHANGE } from 'react-router-redux';
import { fork, call, put, select, takeLatest } from 'redux-saga/effects';

import { actions as auth } from 'containers/Auth/constants';
import * as authSelectors from 'containers/Auth/selectors';
import { apiRequest } from 'utils/APIConnector';
import { ErrorDisplay } from 'utils/error';
import { captureError } from 'utils/errorReporting';

import {
  getLogError,
  getLogSuccess,
  getManifestError,
  getManifestSuccess,
  getPackageError,
  getPackageSuccess,
  getTrafficResponse,
  start,
} from './actions';
import {
  GET_LOG,
  GET_PACKAGE,
  GET_PACKAGE_SUCCESS,
  GET_TRAFFIC,
  START,
  intercomAppId,
} from './constants';
import { selectPackageSummary } from './selectors';

function* callIntercom(method, getData = () => {}, action) {
  if (window.Intercom) {
    const data = yield call(getData, method, action);
    yield call(window.Intercom, method, data);
  }
}

// TODO: move to standalone service
function* intercom({
  boot,
  update,
  shutdown,
  getData,
} = {}) {
  yield takeLatest(boot, callIntercom, 'boot', getData);
  yield takeLatest(update, callIntercom, 'update', getData);
  yield takeLatest(shutdown, callIntercom, 'shutdown', undefined);
}

function* getLog({ name, owner }) {
  try {
    const response = yield call(apiRequest, `/log/${owner}/${name}/`);
    yield put(getLogSuccess(response));
  } catch (e) {
    yield put(getLogError(new ErrorDisplay(
      'Log hiccup', `getLog: ${e.message}`
    )));
    captureError(e);
  }
}

// incoming action is the response from GET_PACKAGE_SUCCESS
// and use takeLatest(function) to discriminate
function* getManifest() {
  try {
    const { name, owner, hash } = yield select(selectPackageSummary);
    const response = yield call(apiRequest, `/package_preview/${owner}/${name}/${hash}`);
    yield put(getManifestSuccess(response));
  } catch (e) {
    yield put(getManifestError(new ErrorDisplay(
      'Manifest hiccup', `getManifest: ${e.message}`
    )));
    captureError(e);
  }
}

function* getPackage({ owner, name }) {
  try {
    const response = yield call(apiRequest, `/tag/${owner}/${name}/latest`);
    yield put(getPackageSuccess(response));
  } catch (e) {
    yield put(getPackageError(new ErrorDisplay(
      'Package hiccup', `getPackage: ${e.message}`
    )));
    captureError(e);
  }
}

function* getTraffic({ payload: { name, owner } }) {
  const events = ['install', 'preview'];
  const endpoint = (event) => `/package_timeseries/${owner}/${name}/${event}`;

  try {
    const [installs, views] = yield events.map((event) =>
      call(apiRequest, endpoint(event)));
    yield put(getTrafficResponse({ installs, views }));
  } catch (e) {
    yield put(getTrafficResponse(new ErrorDisplay(
      'Traffic hiccup', `getTraffic: ${e.message}`
    )));
    captureError(e);
  }
}

export default function* () {
  yield takeLatest(GET_LOG, getLog);
  yield takeLatest(GET_PACKAGE, getPackage);
  yield takeLatest(GET_PACKAGE_SUCCESS, getManifest);
  yield takeLatest(GET_TRAFFIC, getTraffic);

  yield fork(intercom, {
    boot: [START, auth.SIGN_IN_SUCCESS],
    update: LOCATION_CHANGE,
    shutdown: auth.SIGN_OUT,
    * getData() {
      const name = yield select(authSelectors.username);
      const data = name ? { name, user_id: name } : {};
      return { app_id: intercomAppId, ...data };
    },
  });

  yield put(start());
}
