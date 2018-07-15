import { call, put, takeLatest, takeEvery } from 'redux-saga/effects';

import { apiRequest } from 'utils/APIConnector';
import { captureError } from 'utils/errorReporting';

import {
  added,
  getSuccess,
  getError,
  disableSuccess,
  disableError,
  enableSuccess,
  enableError,
  resetPasswordSuccess,
  resetPasswordError,
} from './actions';
import { actions } from './constants';


// some magic here to mitigate the differences between the DTOs used by different endpoints
// eslint-disable-next-line camelcase
const normalizeMember = ([name, { last_seen, is_active = 'none', status, ...member }]) => ({
  name,
  // eslint-disable-next-line camelcase
  lastSeen: last_seen,
  // eslint-disable-next-line camelcase, no-nested-ternary
  status: is_active === 'none' ? status : is_active ? 'active' : 'disabled',
  ...member,
});


export function* add({ payload: { username, email }, meta: { resolve, reject } }) {
  try {
    yield call(apiRequest, {
      endpoint: '/users/create',
      method: 'POST',
      body: { username, email },
    });
    const { users } = yield call(apiRequest, '/users/list_detailed');
    const addedMember = { email, ...normalizeMember([username, users[username]]) };
    yield put(added(addedMember));
    if (resolve) yield call(resolve, addedMember);
  } catch (err) {
    if (reject) yield call(reject, err);
  }
}

export function* get() {
  try {
    const response = yield call(apiRequest, '/users/list_detailed');
    const entries = Object.entries(response.users).map(normalizeMember);
    yield put(getSuccess(entries));
  } catch (e) {
    yield put(getError(e));
    captureError(e);
  }
}

export function* disable({ payload: { name }, meta: { resolve, reject } }) {
  try {
    const response = yield call(apiRequest, {
      endpoint: '/users/disable',
      method: 'POST',
      body: { username: name },
    });
    yield put(disableSuccess(name, response));
    if (resolve) yield call(resolve, response);
  } catch (err) {
    yield put(disableError(name, err));
    if (reject) yield call(reject, err);
  }
}

export function* enable({ payload: { name }, meta: { resolve, reject } }) {
  try {
    const response = yield call(apiRequest, {
      endpoint: '/users/enable',
      method: 'POST',
      body: { username: name },
    });
    yield put(enableSuccess(name, response));
    if (resolve) yield call(resolve, response);
  } catch (err) {
    yield put(enableError(name, err));
    if (reject) yield call(reject, err);
  }
}

export function* resetPassword({ payload: { name }, meta: { resolve, reject } }) {
  try {
    const response = yield call(apiRequest, {
      endpoint: '/users/reset_password',
      method: 'POST',
      body: { username: name },
    });
    yield put(resetPasswordSuccess(name, response));
    if (resolve) yield call(resolve, response);
  } catch (err) {
    yield put(resetPasswordError(name, err));
    if (reject) yield call(reject, err);
  }
}

export default function* () {
  yield takeLatest(actions.ADD, add);
  yield takeLatest(actions.GET, get);
  yield takeEvery(actions.DISABLE, disable);
  yield takeEvery(actions.ENABLE, enable);
  yield takeEvery(actions.RESET_PASSWORD, resetPassword);
}
