import { call, put, takeLatest } from 'redux-saga/effects';

import request from 'utils/sagaRequest';

import { getSuccess, getError } from './actions';
import { actions } from './constants';

export function* get() {
  try {
    const response = yield call(request, '/admin/package_summary');
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
  } catch (err) {
    yield put(getError(err));
  }
}

export default function* () {
  yield takeLatest(actions.GET, get);
}
