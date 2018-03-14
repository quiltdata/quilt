import api from 'constants/api';

import { actions } from './constants';


// get
export const get = () => ({
  type: actions.GET,
});

export const getResponse = (status, response) => ({
  type: actions.GET_RESPONSE,
  payload: { status, response },
});

export const getSuccess = (response) => getResponse(api.SUCCESS, response);
export const getError = (response) => getResponse(api.ERROR, response);


// add
export const add = ({ username, email }, { resolve, reject }) => ({
  type: actions.ADD,
  payload: { username, email },
  meta: { resolve, reject },
});

export const added = (member) => ({
  type: actions.ADDED,
  payload: member,
});


// disable
export const disable = (name, { resolve, reject }) => ({
  type: actions.DISABLE,
  payload: { name },
  meta: { resolve, reject },
});

export const disableResponse = (name, status, response) => ({
  type: actions.DISABLE_RESPONSE,
  payload: { name, status, response },
});

export const disableSuccess = (name, response) =>
  disableResponse(name, api.SUCCESS, response);
export const disableError = (name, response) =>
  disableResponse(name, api.ERROR, response);


// enable
export const enable = (name, { resolve, reject }) => ({
  type: actions.ENABLE,
  payload: { name },
  meta: { resolve, reject },
});

export const enableResponse = (name, status, response) => ({
  type: actions.ENABLE_RESPONSE,
  payload: { name, status, response },
});

export const enableSuccess = (name, response) =>
  enableResponse(name, api.SUCCESS, response);
export const enableError = (name, response) =>
  enableResponse(name, api.ERROR, response);


// reset password
export const resetPassword = (name, { resolve, reject }) => ({
  type: actions.RESET_PASSWORD,
  payload: { name },
  meta: { resolve, reject },
});

export const resetPasswordResponse = (name, status, response) => ({
  type: actions.RESET_PASSWORD_RESPONSE,
  payload: { name },
  meta: { status, response },
});

export const resetPasswordSuccess = (name, response) =>
  resetPasswordResponse(name, api.SUCCESS, response);
export const resetPasswordError = (name, response) =>
  resetPasswordResponse(name, api.ERROR, response);
