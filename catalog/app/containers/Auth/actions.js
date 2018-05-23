import { actions } from './constants';

/**
 * Create a SIGN_UP action.
 *
 * @param {object} credentials
 * @param {string} credentials.username
 * @param {string} credentials.email
 * @param {string} credentials.password
 *
 * @param {object} resolver
 * @param {function} resolver.resolve
 * @param {function} resolver.reject
 *
 * @returns {object} Constructed SIGN_UP action.
 */
export const signUp = (credentials, resolver) => ({
  type: actions.SIGN_UP,
  payload: credentials,
  meta: { ...resolver },
});




export const signIn = (tokens, /* istanbul ignore next */ resolver) => ({
  type: actions.SIGN_IN,
  payload: tokens,
  meta: { ...resolver },
});

signIn.success = (user) => ({
  type: actions.SIGN_IN_SUCCESS,
  payload: user,
});

signIn.error = (e) => ({
  type: actions.SIGN_IN_ERROR,
  payload: e,
});

export const signOut = (resolver) => ({
  type: actions.SIGN_OUT,
  meta: { ...resolver },
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
