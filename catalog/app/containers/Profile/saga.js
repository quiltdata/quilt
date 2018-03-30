/* Profile sagas */
import { call, put, takeLatest } from 'redux-saga/effects';

import config from 'constants/config';
import { requestJSON } from 'utils/request';

import { makeHeaders } from 'utils/auth';
import makeError from 'utils/error';

import {
  getProfileError,
  getProfileSuccess,
  updatePaymentError,
  updatePaymentSuccess,
  updatePlanError,
  updatePlanSuccess,
} from './actions';
import {
  GET_PROFILE,
  UPDATE_PAYMENT,
  UPDATE_PLAN,
} from './constants';

export function* doGetPackages() {
  try {
    const { api: server } = config;
    const headers = yield call(makeHeaders);
    const endpoint = `${server}/api/profile`;
    const response = yield call(requestJSON, endpoint, { method: 'GET', headers });
    if (response.message) {
      throw makeError('Profile hiccup', response.message);
    }
    yield put(getProfileSuccess(response));
  } catch (err) {
    yield put(getProfileError(err));
  }
}

export function* doUpdatePayment(action) {
  try {
    const { api: server } = config;
    const headers = yield call(makeHeaders);
    const endpoint = `${server}/api/payments/update_payment`;
    const data = new FormData();
    data.append('token', action.token);
    const response = yield call(requestJSON, endpoint, { method: 'POST', headers, body: data });
    if (response.message) {
      throw makeError('Payment update hiccup', response.message);
    }
    yield put(updatePaymentSuccess(response));
  } catch (err) {
    yield put(updatePaymentError(err));
  }
}

export function* doUpdatePlan(action) {
  try {
    const { api: server } = config;
    const headers = yield call(makeHeaders);
    const endpoint = `${server}/api/payments/update_plan`;
    const data = new FormData();
    data.append('plan', action.plan);
    if (action.token) {
      data.append('token', action.token);
    }
    const response = yield call(requestJSON, endpoint, { method: 'POST', headers, body: data });
    if (response.message) {
      throw makeError('Payment update hiccup', response.message);
    }
    yield put(updatePlanSuccess(response));
  } catch (err) {
    yield put(updatePlanError(err));
  }
}

export default function* () {
  yield takeLatest(GET_PROFILE, doGetPackages);
  yield takeLatest(UPDATE_PAYMENT, doUpdatePayment);
  yield takeLatest(UPDATE_PLAN, doUpdatePlan);
}
