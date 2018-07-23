import { call, put, takeLatest } from 'redux-saga/effects';

import { apiRequest } from 'utils/APIConnector';
import { captureError } from 'utils/errorReporting';

import { getSuccess, getError } from './actions';
import { actions } from './constants';


export function* get() {
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
    yield put(getSuccess(entries));
  } catch (e) {
    yield put(getError(e));
    captureError(e);
  }
}

export default function* () {
  yield takeLatest(actions.GET, get);
}
