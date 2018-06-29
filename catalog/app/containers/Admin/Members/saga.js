import { call, put, takeLatest, takeEvery } from 'redux-saga/effects';

import makeError from 'utils/error';
import request from 'utils/sagaRequest';

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
    yield call(request, '/users/create', {
      method: 'POST',
      body: JSON.stringify({ username, email }),
    });
    const { users, message } = yield call(request, '/users/list_detailed');
    if (message) throw makeError(message);
    const addedMember = { email, ...normalizeMember([username, users[username]]) };
    yield put(added(addedMember));
    if (resolve) yield call(resolve, addedMember);
  } catch (err) {
    if (reject) yield call(reject, err);
  }
}

export function* get() {
  try {
    const response = yield call(request, '/users/list_detailed');
    if (response.message) throw makeError(response.message);
    const entries = Object.entries(response.users).map(normalizeMember);
    yield put(getSuccess(entries));
  } catch (err) {
    yield put(getError(err));
  }
}

export function* disable({ payload: { name }, meta: { resolve, reject } }) {
  try {
    const response = yield call(request, '/users/disable', {
      method: 'POST',
      body: JSON.stringify({ username: name }),
    });
    if (response.message) throw makeError(response.message);
    yield put(disableSuccess(name, response));
    if (resolve) yield call(resolve, response);
  } catch (err) {
    yield put(disableError(name, err));
    if (reject) yield call(reject, err);
  }
}

export function* enable({ payload: { name }, meta: { resolve, reject } }) {
  try {
    const response = yield call(request, '/users/enable', {
      method: 'POST',
      body: JSON.stringify({ username: name }),
    });
    if (response.message) throw makeError(response.message);
    yield put(enableSuccess(name, response));
    if (resolve) yield call(resolve, response);
  } catch (err) {
    yield put(enableError(name, err));
    if (reject) yield call(reject, err);
  }
}

export function* resetPassword({ payload: { name }, meta: { resolve, reject } }) {
  try {
    const response = yield call(request, '/users/reset_password', {
      method: 'POST',
      body: JSON.stringify({ username: name }),
    });
    if (response.message) throw makeError(response.message);
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
