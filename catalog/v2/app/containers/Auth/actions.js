import { actionCreator } from 'utils/reduxTools';

import { actions } from './constants';


/**
 * Create a SIGN_UP action.
 *
 * @param {{username: string, email: string, password: string}} credentials
 *
 * @param {{resolve: function, reject: function}} resolver
 *
 * @returns {Action}
 */
export const signUp = actionCreator(actions.SIGN_UP, (credentials, resolver) => ({
  payload: credentials,
  meta: { ...resolver },
}));

/**
 * Create a RESET_PASSWORD action.
 *
 * @param {string} email
 *
 * @param {{resolve: function, reject: function}} resolver
 *
 * @returns {Action}
 */
export const resetPassword = actionCreator(actions.RESET_PASSWORD, (email, resolver) => ({
  payload: email,
  meta: { ...resolver },
}));

/**
 * Create a CHANGE_PASSWORD action.
 *
 * @param {string} link
 * @param {string} password
 *
 * @param {{resolve: function, reject: function}} resolver
 *
 * @returns {Action}
 */
export const changePassword = actionCreator(actions.CHANGE_PASSWORD, (link, password, resolver) => ({
  payload: { link, password },
  meta: { ...resolver },
}));

/**
 * Create a GET_CODE action.
 *
 * @param {{resolve: function, reject: function}} resolver
 *
 * @returns {Action}
 */
export const getCode = actionCreator(actions.GET_CODE, (resolver) => ({
  meta: { ...resolver },
}));

/**
 * Create a SIGN_IN action.
 *
 * @param {{username: string, password: string}} credentials
 *
 * @param {{resolve: function, reject: function}} resolver
 *
 * @returns {Action}
 */
export const signIn = actionCreator(actions.SIGN_IN, (credentials, resolver) => ({
  payload: credentials,
  meta: { ...resolver },
}));

/**
 * Create a SIGN_IN_RESULT action.
 *
 * @param {{tokens: Object, user: Object}|Error} result
 *   Either an error or an object containing tokens and user data.
 *   If error, action.error is true.
 *
 * @returns {Action}
 */
signIn.resolve = actionCreator(actions.SIGN_IN_RESULT, (payload) => ({
  error: payload instanceof Error,
  payload,
}));

/**
 * Create a SIGN_OUT action.
 *
 * @param {{ resolve: function, reject: function }} resolver
 *
 * @returns {Action}
 */
export const signOut = actionCreator(actions.SIGN_OUT, (resolver) => ({
  meta: { ...resolver },
}));

/**
 * Create a SIGN_OUT_RESULT action.
 *
 * @param {?Error} result
 *
 * @returns {Action}
 */
signOut.resolve = actionCreator(actions.SIGN_OUT_RESULT, (result) => ({
  error: result instanceof Error,
  payload: result,
}));

/**
 * Create a CHECK action.
 *
 * @param {Object} options
 * @param {boolean} options.refetch
 *   If true, user data will be refetched after token refresh.
 *
 * @param {{ resolve: function, reject: function }} resolver
 *
 * @returns {Action}
 */
export const check = actionCreator(actions.CHECK, ({ refetch = true } = {}, resolver) => ({
  payload: { refetch },
  meta: { ...resolver },
}));

/**
 * Create a REFRESH action.
 *
 * @returns {Action}
 */
export const refresh = actionCreator(actions.REFRESH);

/**
 * Create a REFRESH_RESULT action.
 *
 * @param {{ tokens: Object, user: Object }|Error} payload
 *
 * @returns {Action}
 */
refresh.resolve = actionCreator(actions.REFRESH_RESULT, (payload) => ({
  error: payload instanceof Error,
  payload,
}));

/**
 * Create an AUTH_LOST action.
 *
 * @param {Error} error
 *   Error that caused authentication loss.
 *
 * @returns {Action}
 */
export const authLost = actionCreator(actions.AUTH_LOST, (payload) => ({
  payload,
}));
