import config from 'constants/config';
import { tokenPath } from 'constants/urls';
import { requestJSON, HttpError } from 'utils/request';

import { adjustTokensForLatency, makeHeadersFromTokens } from './util';
import * as errors from './errors';

/**
 * Make a sign-up request.
 *
 * @param {Object} credentials
 *
 * @throws {UserAlreadyExists}
 */
export const signUp = async (credentials) => {
  try {
    console.log('sign up', credentials);
    // TODO: proper url
    //const res = await requestJSON(`${config.api}/register`, {
      //method: 'POST',
      //body: JSON.stringify(credentials),
    //});
    const res = undefined;
    console.log('sign up res', res);
  } catch (e) {
    console.log('sign up: error', e);
    if (e instanceof HttpError) {
      if (e.status === 400 && e.json && e.json.error === 'Unacceptable username.') {
        throw new errors.InvalidUsername({ originalError: e });
      }
      if (e.status === 409 && e.json && e.json.error === 'Username already taken.') {
        throw new errors.UsernameTaken({ originalError: e });
      }
      if (e.status === 409 && e.json && e.json.error === 'Email already taken.') {
        throw new errors.EmailTaken({ originalError: e });
      }
      // TODO: invalid email?
    }
    throw new errors.AuthError({ originalError: e });
  }
};

/**
 * Make a sign-out request (revoke the token).
 *
 * @param {string} token
 */
export const signOut = async (token) => {
  try {
    console.log('sign out', token);
    const res = await requestJSON(`${config.api}/logout`, {
      method: 'POST',
      body: JSON.stringify({ token }),
    });
    console.log('sign out res', res);
  } catch (e) {
    throw new errors.AuthError({
      message: 'unable to sign out',
      originalError: e,
    });
  }
};

/**
 * Make a sign-in request.
 *
 * @param {Object} credentials
 * @param {string} credentials.username
 * @param {string} credentials.password
 */
export const signIn = async (credentials) => {
  try {
    const res = await requestJSON(`${config.api}/login`, {
      method: 'POST',
      body: JSON.stringify(credentials),
    });

    if (res.error) {
      if (res.error === 'Login attempt failed') {
        throw new errors.InvalidCredentials();
      }
      throw new Error(res.error);
    }

    return res;
  } catch (e) {
    if (e instanceof errors.AuthError) throw e;
    throw new errors.AuthError({
      message: 'unable to sign in',
      originalError: e,
    });
  }
}

/**
 * Fetch user data.
 *
 * @param {Object} tokens
 *
 * @returns {Object} User data.
 *
 * @throws {NotAuthenticated} The API responds w/ 401.
 * @throws {AuthError}
 *   Wrap any caught error into AuthError,
 *   with original error attached as `originalError` property.
 */
export const fetchUser = async (tokens) => {
  try {
    console.log('fetchUser', tokens);
    //const auth = await requestJSON(config.userApi, {
      //headers: makeHeadersFromTokens(tokens),
    //});
    /* istanbul ignore next */
    //return auth.login && !auth.current_user
      //// GitHub
      //? { ...auth, current_user: auth.login }
      //: auth;

    return {
      is_staff: false,
      is_active: true,
      email: 'admin@quilt',
      current_user: 'admin',
    };

  } catch (e) {
    if (e instanceof HttpError && e.status === 401) {
      throw new errors.NotAuthenticated({ originalError: e });
    }

    throw new errors.AuthError({
      message: 'unable to fetch user data',
      originalError: e,
    });
  }
}

/**
 * Make a password reset request.
 *
 * @param {string} email
 *
 * @throws {AuthError}
 */
export const resetPassword = async (email) => {
  try {
    console.log('reset pw', email);
    //const res = await requestJSON(`${config.api}/reset_password`, {
      //method: 'POST',
      //body: JSON.stringify({ email }),
    //});
  } catch (e) {
    console.log('reset pw error', e);
    throw new errors.AuthError({
      message: 'unable to reset password',
      originalError: e,
    });
  }
}

/**
 * Make a password change request.
 *
 * @param {string} link
 * @param {string} password
 *
 * @throws {AuthError}
 * @throws {UserNotFound}
 */
export const changePassword = async (link, password) => {
  try {
    console.log('change pw', { link, password });
    //const res = await requestJSON(`${config.api}/reset_password/${link}`, {
      //method: 'POST',
      //body: JSON.stringify({ password }),
    //});
  } catch (e) {
    console.log('change pw error', e);
    if (
      e instanceof HttpError && e.status === 404
      && e.json && e.json.error === 'User not found.'
    ) {
      throw new error.UserNotFound({ originalError: e });
    }

    throw new errors.AuthError({
      message: 'unable to change password',
      originalError: e,
    });
  }
};

/**
 * Get the code from the API.
 *
 * @param {Object} tokens
 *
 * @throws {AuthError}
 */
export const getCode = async (tokens) => {
  try {
    console.log('get code');
    const headers = makeHeadersFromTokens(tokens);
    //const res = await requestJSON(`${config.api}/api/code`, { headers });
    const res = { code: 'THE_CODE' };
    console.log('get code: res', res);
    return res.code;
  } catch (e) {
    console.log('get code err', e);
    throw new errors.AuthError({
      message: 'unable to get the code',
      originalError: e,
    });
  }
};

// OLD
/**
 * Refresh auth tokens.
 *
 * @param {string} refreshToken
 *
 * @returns {Object} Tokens adjusted for latency.
 *
 * @throws {NotAuthenticated} The API responds w/ 401.
 * @throws {AuthError}
 *   Wrap any caught error into AuthError,
 *   with original error attached as `originalError` property.
 */
export const refreshTokens = async (refreshToken) => {
  try {
    const body = new FormData();
    body.append('refresh_token', refreshToken);
    const newTokens = await requestJSON(`${config.api}${tokenPath}`, {
      method: 'POST',
      body,
    });
    // response could be ok per request method checks but still harbor error
    if (newTokens.error) {
      //throw makeError('Auth refresh hiccup', `refreshTokens: ${newTokens.error}`);
      throw new AuthError('unable to refresh tokens', {
        originalError: newTokens.error,
      });
    }
    return adjustTokensForLatency(newTokens);
  } catch (e) {
    if (e instanceof HttpError && e.status === 401) {
      throw new errors.NotAuthenticated('unable to refresh tokens');
    }
    if (e instanceof errors.AuthError) throw e;
    throw new errors.AuthError('unable to refresh tokens', { originalError: e });
  }
}
