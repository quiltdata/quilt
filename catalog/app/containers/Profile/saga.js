/* Profile sagas */
import { call, put, takeLatest } from 'redux-saga/effects';

import { apiRequest } from 'utils/APIConnector';
import { ErrorDisplay } from 'utils/error';
import { captureError } from 'utils/errorReporting';

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


const mkFormData = (data) => {
  const fd = new FormData();
  Object.entries(data).forEach(([k, v]) => {
    if (v) fd.append(k, v);
  });
  return fd;
};

export function* doGetPackages() {
  try {
    const response = yield call(apiRequest, '/profile');
    yield put(getProfileSuccess(response));
  } catch (e) {
    yield put(getProfileError(new ErrorDisplay(
      'Profile hiccup', `doGetPackages: ${e.message}`
    )));
    captureError(e);
  }
}

export function* doUpdatePayment({ token }) {
  try {
    const response = yield call(apiRequest, {
      endpoint: '/payments/update_payment',
      method: 'POST',
      body: mkFormData({ token }),
    });
    yield put(updatePaymentSuccess(response));
  } catch (e) {
    yield put(updatePaymentError(new ErrorDisplay(
      'Payment update hiccup', `doUpdatePayment: ${e.message}`
    )));
    captureError(e);
  }
}

export function* doUpdatePlan({ plan, token }) {
  try {
    const response = yield call(apiRequest, {
      endpoint: '/payments/update_plan',
      method: 'POST',
      body: mkFormData({ plan, token }),
    });
    yield put(updatePlanSuccess(response));
  } catch (e) {
    yield put(updatePlanError(new ErrorDisplay(
      'Payment update hiccup', `doUpdatePlan: ${e.message}`
    )));
    captureError(e);
  }
}

export default function* () {
  yield takeLatest(GET_PROFILE, doGetPackages);
  yield takeLatest(UPDATE_PAYMENT, doUpdatePayment);
  yield takeLatest(UPDATE_PLAN, doUpdatePlan);
}
