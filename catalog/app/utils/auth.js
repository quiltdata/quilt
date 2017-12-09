/* auth utils */
import assert from 'assert';
import { select } from 'redux-saga/effects';

import config from 'constants/config';
import { authenticatedRoutes } from 'containers/App/constants';
import {
  makeSelectAuth,
  makeSelectSignedIn,
} from 'containers/App/selectors';
import { authHandlerPath, authorizePath } from 'constants/urls';

/* deprecated and not in use - user could be in the process of authenticating and
 * this function will kick them out because GET_AUTH_SUCCESS
 * has yet to return */
export function makeCheckEntry(store) {
  return (nextState, replace, cb) => {
    const { location: { pathname } } = nextState;
    if (requiresAuth(pathname)) {
      const state = store.getState();
      const authenticated = makeSelectSignedIn()(state);
      if (!authenticated) {
        // send the user home
        replace('/');
      }
    }
    // transition blocks until and unless cb() is called
    cb();
  };
}

export function requiresAuth(path = '') {
  assert(typeof path === 'string', `requiresAuth: path must be a string: ${path}`);
  return authenticatedRoutes.some((route) => path.startsWith(route));
}

export function* makeHeaders() {
  const authenticated = yield select(makeSelectSignedIn());
  const { tokens } = yield select(makeSelectAuth());
  return authenticated ? makeHeadersFromTokens(tokens) : {};
}

export function makeHeadersFromTokens(tokens) {
  return { Authorization: `Bearer ${tokens.access_token}` };
}

export function makeSignInURL() {
  const { origin, pathname } = window.location;
  // if user signs in from home, send them to /profile on completion
  const nextPath = pathname === '/' ? '/profile' : pathname;
  const { api: server } = config;
  const redirect = makeRedirectURL(origin, authHandlerPath, nextPath);
  const authRedirect = makeRedirectURL(server, authorizePath, redirect);

  // TODO(dima): Sign up vs sign in?

  return authRedirect;
}

export function makeSignOutURL() {
  const { signOutUrl: url } = config;
  return url || '/';
}

export function makeRedirectURL(origin, path, next = '/') {
  return `${origin}${path}?next=${encodeURIComponent(next)}`;
}
