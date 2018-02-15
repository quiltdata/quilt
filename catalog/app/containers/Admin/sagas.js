import { call, put, takeLatest, takeEvery } from 'redux-saga/effects';

import config from 'constants/config';
import { makeHeaders } from 'utils/auth';
import makeError from 'utils/error';
import { requestJSON } from 'utils/request';

import {
  addMemberSuccess,
  addmemberError,
  getMembersSuccess,
  getMembersError,
  getMemberAuditSuccess,
  getMemberAuditError,
  removeMemberSuccess,
  removeMemberError,
  resetMemberPasswordSuccess,
  resetMemberPasswordError,
  getPackagesSuccess,
  getPackagesError,
  getPackageAuditSuccess,
  getPackageAuditError,
  removePackageSuccess,
  removePackageError,
} from './actions';
import {
  ADD_MEMBER,
  GET_MEMBERS,
  GET_MEMBER_AUDIT,
  REMOVE_MEMBER,
  RESET_MEMBER_PASSWORD,
  GET_PACKAGES,
  GET_PACKAGE_AUDIT,
  REMOVE_PACKAGE,
} from './constants';


function* apiRequest(endpoint, opts = {}) {
  const headers = yield call(makeHeaders);
  const response = yield call(requestJSON, `${config.api}/api${endpoint}`, { headers, ...opts });
  if (response.message) {
    throw makeError(response.message);
  }
  return response;
}


// add member
export function* doAddMember({ name, email }) {
  try {
    const response = yield call(apiRequest, '/users/create', {
      method: 'POST',
      body: JSON.stringify({ username: name, email }),
    });
    yield put(addMemberSuccess(response));
  } catch (err) {
    yield put(addmemberError(err));
  }
}

export function* watchAddMember() {
  yield takeLatest(ADD_MEMBER, doAddMember);
}


// members
export function* doGetMembers() {
  try {
    const response = yield call(apiRequest, '/users/list_detailed');
    const entries = Object.entries(response.users)
      .map(([name, { last_seen, ...member }]) => ({ name, lastSeen: last_seen, ...member }));
    yield put(getMembersSuccess(entries));
  } catch (err) {
    yield put(getMembersError(err));
  }
}

export function* watchGetMembers() {
  yield takeLatest(GET_MEMBERS, doGetMembers);
}


// member audit
export function* doGetMemberAudit({ name }) {
  if (!name) return;
  try {
    const response = yield call(apiRequest, `/audit/${name}/`);
    const events = response.events.map(({ created, package_owner, package_name, type }) => ({
      time: created * 1000,
      handle: `${package_owner}/${package_name}`,
      event: type.toLowerCase(),
    }));
    yield put(getMemberAuditSuccess(events));
  } catch (err) {
    yield put(getMemberAuditError(err));
  }
}

export function* watchGetMemberAudit() {
  yield takeLatest(GET_MEMBER_AUDIT, doGetMemberAudit);
}


// remove member
export function* doRemoveMember({ name }) {
  console.log('doRemoveMember', name);
  try {
    const response = yield call(apiRequest, '/users/disable', {
      method: 'POST',
      body: JSON.stringify({ username: name }),
    });
    yield put(removeMemberSuccess(name, response));
  } catch (err) {
    yield put(removeMemberError(name, err));
  }
}

export function* watchRemoveMember() {
  yield takeEvery(REMOVE_MEMBER, doRemoveMember);
}


// reset member password
export function* doResetMemberPassword({ name }) {
  console.log('doResetMemberPassword', name);
  try {
    const response = yield call(apiRequest, '/users/reset_password', {
      method: 'POST',
      body: JSON.stringify({ username: name }),
    });
    yield put(resetMemberPasswordSuccess(name, response));
  } catch (err) {
    yield put(resetMemberPasswordError(name, err));
  }
}

export function* watchResetMemberPassword() {
  yield takeEvery(RESET_MEMBER_PASSWORD, doResetMemberPassword);
}


// packages
export function* doGetPackages() {
  try {
    const response = yield call(apiRequest, '/admin/package_summary');
    const entries = Object.entries(response.packages)
      .map(([handle, pkg]) => ({pkg,handle}), {
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

export function* watchGetPackages() {
  yield takeLatest(GET_PACKAGES, doGetPackages);
}


// package audit
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

export function* watchGetPackageAudit() {
  yield takeLatest(GET_PACKAGE_AUDIT, doGetPackageAudit);
}


// remove package
export function* doRemovePackage({ handle }) {
  console.log('doRemovePackage', handle);
  try {
    const response = yield call(apiRequest, `/package/${handle}/`, { method: 'DELETE' });
    yield put(removePackageSuccess(handle, response));
  } catch (err) {
    yield put(removePackageError(handle, err));
  }
}

export function* watchRemovePackage() {
  yield takeEvery(REMOVE_PACKAGE, doRemovePackage);
}


// All sagas to be loaded
export default [
  watchAddMember,
  watchGetMembers,
  watchGetMemberAudit,
  watchRemoveMember,
  watchResetMemberPassword,
  watchGetPackages,
  watchGetPackageAudit,
  watchRemovePackage,
];
