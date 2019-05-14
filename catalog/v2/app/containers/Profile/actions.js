/* Profile actions */
import {
  GET_PROFILE,
  GET_PROFILE_ERROR,
  GET_PROFILE_SUCCESS,
  UPDATE_PAYMENT,
  UPDATE_PAYMENT_ERROR,
  UPDATE_PAYMENT_SUCCESS,
  UPDATE_PLAN,
  UPDATE_PLAN_ERROR,
  UPDATE_PLAN_SUCCESS,
} from './constants';

export function getProfile() {
  return {
    type: GET_PROFILE,
  };
}

export function getProfileError(error) {
  return {
    type: GET_PROFILE_ERROR,
    error,
  };
}

export function getProfileSuccess(response) {
  return {
    type: GET_PROFILE_SUCCESS,
    response,
  };
}

export function updatePayment(token, onSuccess) {
  return {
    type: UPDATE_PAYMENT,
    onSuccess,
    token,
  };
}

export function updatePaymentError(error) {
  return {
    type: UPDATE_PAYMENT_ERROR,
    error,
  };
}

export function updatePaymentSuccess() {
  return {
    type: UPDATE_PAYMENT_SUCCESS,
  };
}

export function updatePlan(plan, token) {
  return {
    type: UPDATE_PLAN,
    plan,
    token,
  };
}

export function updatePlanError(error) {
  return {
    type: UPDATE_PLAN_ERROR,
    error,
  };
}

export function updatePlanSuccess(response) {
  return {
    type: UPDATE_PLAN_SUCCESS,
    response,
  };
}
