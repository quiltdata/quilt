import { call, put, takeLatest } from 'redux-saga/effects';

import config from 'constants/config';
import { makeHeaders } from 'utils/auth';
import makeError from 'utils/error';
import { requestJSON } from 'utils/request';

import {
  getMembersSuccess,
  getMembersError,
  getPackagesSuccess,
  getPackagesError,
} from './actions'
import { GET_MEMBERS, GET_PACKAGES } from './constants'

// mock data
const now = Date.now();
function rtime() {
  const t = new Date(now - (Math.random() * 1000000000));
  return t.toLocaleString();
}
//const memberData = [
  //{ name: 'azander', last_seen: rtime() },
  //{ name: 'bgross', last_seen: rtime() },
  //{ name: 'dcaufield', last_seen: rtime() },
  //{ name: 'emobley', last_seen: rtime() },
  //{ name: 'fstitches', last_seen: rtime() },
  //{ name: 'gvanderplas', last_seen: rtime() },
  //{ name: 'hmcauley', last_seen: rtime() },
  //{ name: 'hsanders', last_seen: rtime() },
  //{ name: 'jkarve', last_seen: rtime() },
  //{ name: 'klimnose', last_seen: rtime() },
//];

const packageData = [
  { name: 'emobley/commodities', last_seen: rtime() },
  { name: 'emobley/models', last_seen: rtime() },
  { name: 'fstitches/imagedb1', last_seen: rtime() },
  { name: 'fstitches/imagedb2', last_seen: rtime() },
  { name: 'fstitches/imagedb3', last_seen: rtime() },
  { name: 'rob/arbitrage', last_seen: rtime() },
  { name: 'rob/bonds', last_seen: rtime() },
  { name: 'rob/imds', last_seen: rtime() },
  { name: 'rob/treasuries', last_seen: rtime() },
  { name: 'rob/value', last_seen: rtime() },
];

export function* doGetMembers() {
  try {
    const headers = yield call(makeHeaders);
    const endpoint = `${config.api}/api/users/list_detailed`;
    const response = yield call(requestJSON, endpoint, { headers });
    if (response.message) {
      throw makeError(response.message);
    }
    yield put(getMembersSuccess(response.users));
  } catch (err) {
    yield put(getMembersError(err));
  }
}

export function* watchGetMembers() {
  yield takeLatest(GET_MEMBERS, doGetMembers);
}

export function* doGetPackages() {
  try {
    //const headers = yield call(makeHeaders);
    //const endpoint = `${config.api}/api/users/list_detailed`;
    //const response = yield call(requestJSON, endpoint, { headers });
    //if (response.message) {
      //throw makeError(response.message);
    //}
    //yield put(getPackagesSuccess(response.users));
    yield put(getPackagesSuccess(packageData));
  } catch (err) {
    yield put(getPackagesError(err));
  }
}

export function* watchGetPackages() {
  yield takeLatest(GET_PACKAGES, doGetPackages);
}

// All sagas to be loaded
export default [
  watchGetMembers,
  watchGetPackages,
];
