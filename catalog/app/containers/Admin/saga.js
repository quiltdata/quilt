import { call, put, takeLatest, takeEvery } from 'redux-saga/effects';

import config from 'constants/config';
import { makeHeaders } from 'utils/auth';
import makeError from 'utils/error';
import { requestJSON } from 'utils/request';

import {
  memberAdded,
  getMembersSuccess,
  getMembersError,
  getMemberAuditSuccess,
  getMemberAuditError,
  disableMemberSuccess,
  disableMemberError,
  enableMemberSuccess,
  enableMemberError,
  resetMemberPasswordSuccess,
  resetMemberPasswordError,
  getPackagesSuccess,
  getPackagesError,
  getPackageAuditSuccess,
  getPackageAuditError,
} from './actions';
import {
  ADD_MEMBER,
  GET_MEMBERS,
  GET_MEMBER_AUDIT,
  DISABLE_MEMBER,
  ENABLE_MEMBER,
  RESET_MEMBER_PASSWORD,
  GET_PACKAGES,
  GET_PACKAGE_AUDIT,
} from './constants';


function* apiRequest(endpoint, opts = {}) {
  const headers = yield call(makeHeaders);
  const response = yield call(requestJSON, `${config.api}/api${endpoint}`, {
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    ...opts,
  });
  if (response.message) {
    throw makeError(response.message);
  }
  return response;
}

// some magic here to mitigate the differences between the DTOs used by different endpoints
// eslint-disable-next-line camelcase, object-curly-newline
const normalizeMember = ([name, { last_seen, is_active = 'none', status, ...member }]) => ({
  name,
  // eslint-disable-next-line camelcase
  lastSeen: last_seen,
  // eslint-disable-next-line camelcase, no-nested-ternary
  status: is_active === 'none' ? status : is_active ? 'active' : 'disabled',
  ...member,
});


// eslint-disable-next-line object-curly-newline
export function* doAddMember({ username, email, resolve, reject }) {
  try {
    yield call(apiRequest, '/users/create', {
      method: 'POST',
      body: JSON.stringify({ username, email }),
    });
    const { users } = yield call(apiRequest, '/users/list_detailed');
    const addedMember = { email, ...normalizeMember([username, users[username]]) };
    yield put(memberAdded(addedMember));
    if (resolve) yield call(resolve, addedMember);
  } catch (err) {
    if (reject) yield call(reject, err);
  }
}

export function* doGetMembers() {
  try {
    const response = yield call(apiRequest, '/users/list_detailed');
    const entries = Object.entries(response.users).map(normalizeMember);
    yield put(getMembersSuccess(entries));
  } catch (err) {
    yield put(getMembersError(err));
  }
}

export function* doGetMemberAudit({ name }) {
  if (!name) return;
  try {
    const response = yield call(apiRequest, `/audit/${name}/`);
    // eslint-disable-next-line object-curly-newline, camelcase
    const events = response.events.map(({ created, package_owner, package_name, type }) => ({
      time: created * 1000,
      // eslint-disable-next-line camelcase
      handle: `${package_owner}/${package_name}`,
      event: type.toLowerCase(),
    }));
    yield put(getMemberAuditSuccess(events));
  } catch (err) {
    yield put(getMemberAuditError(err));
  }
}

export function* doDisableMember({ name, resolve, reject }) {
  try {
    const response = yield call(apiRequest, '/users/disable', {
      method: 'POST',
      body: JSON.stringify({ username: name }),
    });
    yield put(disableMemberSuccess(name, response));
    if (resolve) yield call(resolve, response);
  } catch (err) {
    yield put(disableMemberError(name, err));
    if (reject) yield call(reject, err);
  }
}

export function* doEnableMember({ name, resolve, reject }) {
  try {
    const response = yield call(apiRequest, '/users/enable', {
      method: 'POST',
      body: JSON.stringify({ username: name }),
    });
    yield put(enableMemberSuccess(name, response));
    if (resolve) yield call(resolve, response);
  } catch (err) {
    yield put(enableMemberError(name, err));
    if (reject) yield call(reject, err);
  }
}

export function* doResetMemberPassword({ name, resolve, reject }) {
  try {
    const response = yield call(apiRequest, '/users/reset_password', {
      method: 'POST',
      body: JSON.stringify({ username: name }),
    });
    yield put(resetMemberPasswordSuccess(name, response));
    if (resolve) yield call(resolve, response);
  } catch (err) {
    yield put(resetMemberPasswordError(name, err));
    if (reject) yield call(reject, err);
  }
}

export function* doGetPackages() {
  try {
    const response = yield call(apiRequest, '/admin/package_summary');
    const entries = Object.entries(response.packages)
      .map(([handle, pkg]) => ({
        handle,
        lastModified: Math.max(pkg.deletes.latest || 0, pkg.pushes.latest || 0) * 1000,
        deletes: pkg.deletes.count,
        installs: pkg.installs.count,
        previews: pkg.previews.count,
        pushes: pkg.pushes.count,
      }));
    yield put(getPackagesSuccess(entries));
  } catch (err) {
    yield put(getPackagesError(err));
  }
}

export function* doGetPackageAudit({ handle }) {
  if (!handle) return;
  try {
    const response = yield call(apiRequest, `/audit/${handle}/`);
    const events = response.events.map(({ created, user, type }) => ({
      time: created * 1000,
      user,
      event: type.toLowerCase(),
    }));
    yield put(getPackageAuditSuccess(events));
  } catch (err) {
    yield put(getPackageAuditError(err));
  }
}

export default function* () {
  yield takeLatest(ADD_MEMBER, doAddMember);
  yield takeLatest(GET_MEMBERS, doGetMembers);
  yield takeLatest(GET_MEMBER_AUDIT, doGetMemberAudit);
  yield takeEvery(DISABLE_MEMBER, doDisableMember);
  yield takeEvery(ENABLE_MEMBER, doEnableMember);
  yield takeEvery(RESET_MEMBER_PASSWORD, doResetMemberPassword);
  yield takeLatest(GET_PACKAGES, doGetPackages);
  yield takeLatest(GET_PACKAGE_AUDIT, doGetPackageAudit);
}
