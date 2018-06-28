/* App sagas */
import { LOCATION_CHANGE } from 'react-router-redux';
import { fork, call, put, select, takeLatest } from 'redux-saga/effects';

import { actions as auth } from 'containers/Auth/constants';
import * as authSelectors from 'containers/Auth/selectors';
import makeError from 'utils/error';
import request from 'utils/sagaRequest';

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
    const response = yield call(request, `/log/${owner}/${name}/`);
    yield put(getLogSuccess(response));
  } catch (error) {
    error.headline = 'Log hiccup';
    error.detail = `doGetLog: ${error.message}`;
    yield put(getLogError(error));
  }
}

// incoming action is the response from GET_PACKAGE_SUCCESS
// and use takeLatest(function) to discriminate
function* getManifest() {
  try {
    const { name, owner, hash } = yield select(selectPackageSummary);
    const response = yield call(request, `/package_preview/${owner}/${name}/${hash}`);
    if (response.message) throw makeError('Manifest hiccup', response.message);
    yield put(getManifestSuccess(response));
  } catch (error) {
    error.headline = 'Manifest hiccup';
    error.detail = `getManifest: ${error.message}`;
    yield put(getManifestError(error));
  }
}

function* getPackage({ owner, name }) {
  try {
    const response = yield call(request, `/tag/${owner}/${name}/latest`);
    if (response.message) throw makeError('Package hiccup', response.message);
    yield put(getPackageSuccess(response));
  } catch (err) {
    if (!err.headline) {
      err.headline = 'Package hiccup';
      err.detail = `getPackage: ${err.message}`;
    }
    yield put(getPackageError(err));
  }
}

function* getTraffic({ payload: { name, owner } }) {
  const events = ['install', 'preview'];
  const endpoint = (event) => `/package_timeseries/${owner}/${name}/${event}`;

  try {
    const [installs, views] = yield events.map((event) =>
      call(request, endpoint(event)));
    yield put(getTrafficResponse({ installs, views }));
  } catch (err) {
    yield put(getTrafficResponse(err));
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
