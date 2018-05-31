import config from 'constants/config';
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
    await requestJSON(`${config.api}/register`, {
      method: 'POST',
      body: JSON.stringify(credentials),
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch (e) {
    if (e instanceof HttpError) {
      if (e.status === 400 && e.json && e.json.error === 'Unacceptable username.') {
        throw new errors.InvalidUsername({ originalError: e });
      }
      if (e.status === 400 && e.json && e.json.error === 'Unacceptable email.') {
        throw new errors.InvalidEmail({ originalError: e });
      }
      if (e.status === 409 && e.json && e.json.error === 'Username already taken.') {
        throw new errors.UsernameTaken({ originalError: e });
      }
      if (e.status === 409 && e.json && e.json.error === 'Email already taken.') {
        throw new errors.EmailTaken({ originalError: e });
      }
    }
    throw new errors.AuthError({ originalError: e });
  }
};

/**
 * Make a sign-out request (revoke the token).
 *
 * @param {string} token
 */
export const signOut = async (tokens) => {
  try {
    await requestJSON(`${config.api}/logout`, {
      method: 'POST',
      body: JSON.stringify({ token: tokens.token }),
      headers: {
        ...makeHeadersFromTokens(tokens),
        'Content-Type': 'application/json',
      },
    });
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
};

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
    const auth = await requestJSON(`${config.api}/api-root`, {
      headers: makeHeadersFromTokens(tokens),
    });

    return auth;
  } catch (e) {
    if (e instanceof HttpError && e.status === 401) {
      throw new errors.NotAuthenticated({ originalError: e });
    }

    throw new errors.AuthError({
      message: 'unable to fetch user data',
      originalError: e,
    });
  }
};

/**
 * Make a password reset request.
 *
 * @param {string} email
 *
 * @throws {AuthError}
 */
export const resetPassword = async (email) => {
  try {
    await requestJSON(`${config.api}/reset_password`, {
      method: 'POST',
      body: JSON.stringify({ email }),
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch (e) {
    throw new errors.AuthError({
      message: 'unable to reset password',
      originalError: e,
    });
  }
};

/**
 * Make a password change request.
 *
 * @param {string} link
 * @param {string} password
 *
 * @throws {AuthError}
 * @throws {InvalidResetLink}
 */
export const changePassword = async (link, password) => {
  try {
    await requestJSON(`${config.api}/reset_password`, {
      method: 'POST',
      body: JSON.stringify({ link, password }),
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch (e) {
    if (e instanceof HttpError) {
      if (e.status === 404 && e.json && e.json.error === 'User not found.') {
        throw new errors.InvalidResetLink({ originalError: e });
      }
      if (e.status === 400 && e.json && e.json.error === 'Invalid link.') {
        throw new errors.InvalidResetLink({ originalError: e });
      }
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
 * @returns {string} The code.
 *
 * @throws {AuthError}
 */
export const getCode = async (tokens) => {
  try {
    const { code } = await requestJSON(`${config.api}/api/code`, {
      headers: makeHeadersFromTokens(tokens),
    });
    return code;
  } catch (e) {
    throw new errors.AuthError({
      message: 'unable to get the code',
      originalError: e,
    });
  }
};

/**
 * Refresh auth tokens.
 *
 * @param {Object} tokens
 *
 * @returns {Object} Refreshed tokens adjusted for latency.
 *
 * @throws {AuthError}
 */
export const refreshTokens = async (tokens) => {
  try {
    const newTokens = await requestJSON(`${config.api}/api/refresh`, {
      method: 'POST',
      headers: makeHeadersFromTokens(tokens),
    });
    return adjustTokensForLatency(newTokens);
  } catch (e) {
    if (e instanceof HttpError && e.status === 401) {
      throw new errors.NotAuthenticated({ originalError: e });
    }
    throw new errors.AuthError({
      message: 'unable to refresh tokens',
      originalError: e,
    });
  }
};
