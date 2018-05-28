import { actions } from './constants';

/**
 * Create a SIGN_IN action.
 *
 * @param {{username: string, password: string} credentials
 *
 * @param {{resolve: function, reject: function}} resolver
 *
 * @returns {Action}
 */
export const signIn = (credentials, resolver) => ({
  type: actions.SIGN_IN,
  payload: credentials,
  meta: { ...resolver },
});

/**
 * Create a SIGN_IN_RESULT action.
 *
 * @param {{tokens: Object, user: Object}|Error} result
 *   Either an error or an object containing tokens and user data.
 *   If error, action.error is true.
 *
 * @returns {Action}
 */
signIn.resolve = (result) => ({
  type: actions.SIGN_IN_RESULT,
  error: result instanceof Error,
  payload: result,
});

/**
 * Create a SIGN_OUT action.
 *
 * @param {{ resolve: function, reject: function }} resolver
 *
 * @returns {Action}
 */
export const signOut = (resolver) => ({
  type: actions.SIGN_OUT,
  meta: { ...resolver },
});

/**
 * Create a SIGN_OUT_RESULT action.
 *
 * @param {?Error} result
 *
 * @returns {Action}
 */
signOut.resolve = (result) => ({
  type: actions.SIGN_OUT_RESULT,
  error: result instanceof Error,
  payload: result,
});

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
export const check = ({ refetch = true } = {}, resolver) => ({
  type: actions.CHECK,
  payload: { refetch },
  meta: { ...resolver },
});

/**
 * Create a REFRESH action.
 *
 * @returns {Action}
 */
export const refresh = () => ({
  type: actions.REFRESH,
});

/**
 * Create a REFRESH_RESULT action.
 *
 * @param {{ tokens: Object, user: Object }|Error} payload
 *
 * @returns {Action}
 */
refresh.resolve = (payload) => ({
  type: actions.REFRESH_SUCCESS,
  error: payload instanceof Error,
  payload,
});

/**
 * Create an AUTH_LOST action.
 *
 * @param {Error} error
 *   Error that caused authentication loss.
 *
 * @returns {Action}
 */
export const authLost = (e) => ({
  type: actions.AUTH_LOST,
  payload: e,
});
