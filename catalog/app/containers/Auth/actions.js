import { actions } from './constants';

/**
 * Create a SIGN_UP action.
 *
 * @param {Object} credentials
 * @param {string} credentials.username
 * @param {string} credentials.email
 * @param {string} credentials.password
 *
 * @param {Object} resolver
 * @param {function} resolver.resolve
 * @param {function} resolver.reject
 *
 * @returns {Action} Constructed SIGN_UP action.
 */
export const signUp = (credentials, resolver) => ({
  type: actions.SIGN_UP,
  payload: credentials,
  meta: { ...resolver },
});


/**
 * Create a SIGN_IN action.
 *
 * @param {{username: string, password: string} credentials
 *
 * @param {{resolve: string, reject: string}} resolver
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
 * @param {Object} resolver
 * @param {function} resolver.resolve
 * @param {function} resolver.reject
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
 * @returns {Action}
 */
signOut.resolve = (result) => ({
  type: actions.SIGN_OUT_RESULT,
  error: result instanceof Error,
  payload: result,
});

export const check = ({ refetch = true }, resolver) => ({
  type: actions.CHECK,
  payload: { refetch },
  meta: { ...resolver },
});

export const refresh = () => ({
  type: actions.REFRESH,
});

refresh.success = (tokens, user) => ({
  type: actions.REFRESH_SUCCESS,
  payload: { tokens, user },
});

refresh.error = (e) => ({
  type: actions.REFRESH_ERROR,
  payload: e,
});

export const authLost = (e) => ({
  type: actions.AUTH_LOST,
  payload: e,
});
