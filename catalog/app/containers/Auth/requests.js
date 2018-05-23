import config from 'constants/config';
import { tokenPath } from 'constants/urls';
import { requestJSON, HttpError } from 'utils/request';

import { adjustTokensForLatency, makeHeadersFromTokens } from './util';
import * as errors from './errors';

/**
 * Make a sign-up request.
 *
 * @param {object} credentials
 *
 * @throws {UserAlreadyExists}
 */
export const signUp = async (credentials) => {
  try {
    console.log('sign up', credentials);
    // TODO: proper url
    const res = await requestJSON('/register', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
    console.log('sign up res', res);
  } catch (e) {
    console.log('sign up: error', e);
    if (e instanceof HttpError && e.status === 409) {
      throw new errors.UserAlreadyExists({ originalError: e });
    }
    throw e;
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
    // TODO: proper url
    const res = await requestJSON('/logout', {
      method: 'POST',
      body: JSON.stringify({ token }),
    });
    console.log('sign out res', res);
  } catch (e) {
    // TODO: handle expected BE errors
    console.log('sign out: error', e);
    throw e;
  }
};

/**
 * Make a sign-in request
 *
 * @param {object} credentials
 * @param {string} credentials.username
 * @param {string} credentials.password
 */
export const signIn = async (credentials) => {
  try {
    console.log('sign in', credentials);
    // TODO: proper url
    const res = await requestJSON('/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
    console.log('sign in res', res);
    return res;
  } catch (e) {
    // TODO: handle expected BE errors
    console.log('sign in: error', e);
    throw e;
  }
}


// OLD
/**
 * Fetch user data from the User API.
 *
 * @returns {object} User data.
 *
 * @throws {NotAuthenticated} The API responds w/ 401.
 * @throws {AuthError}
 *   Wrap any caught error into AuthError,
 *   with original error attached as `originalError` property.
 */
export const fetchUser = async (tokens) => {
  try {
    const auth = await requestJSON(config.userApi, {
      headers: makeHeadersFromTokens(tokens),
    });
    /* istanbul ignore next */
    return auth.login && !auth.current_user
      // GitHub
      ? { ...auth, current_user: auth.login }
      : auth;
  } catch (e) {
    if (e instanceof HttpError && e.status === 401) {
      throw new errors.NotAuthenticated('unable to fetch user data');
    }

    // TODO: do it in error boundary instead?
    //captureError(e);

    throw new errors.AuthError('unable to fetch user data', { originalError: e });

    /* istanbul ignore next */
    //if (!err.headline) {
      //err.headline = 'Auth request hiccup';
      //err.detail = `fetchUser: ${err.message}`;
    //}
    //throw err;
  }
}

/**
 * Refresh auth tokens.
 *
 * @param {string} refreshToken
 *
 * @returns {object} Tokens adjusted for latency.
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
