import { stringify } from 'query-string';

import config from 'constants/config';
import { authHandlerPath, authorizePath } from 'constants/urls';

import { LATENCY_SECONDS } from './constants';

export const makeHeadersFromTokens = (tokens) => ({
  Authorization: `Bearer ${tokens.access_token}`,
});

const makeURL = (url, query) =>
  `${url}?${stringify(query)}`;

const getPath = (loc) => loc.pathname + loc.search;

// polyfill location.origin for IE 10
const getOrigin = (loc) =>
  loc.origin || /* istanbul ignore next */ `${loc.protocol}//${loc.host}`;

export const makeSignInURL = (
  path = getPath(window.location),
  origin = getOrigin(window.location),
) =>
  // TODO(dima): Sign up vs sign in?
  makeURL(config.api + authorizePath, {
    next: makeURL(origin + authHandlerPath, {
      // if user signs in from home, send them to /profile on completion
      next: path === '/' ? '/profile' : path,
    }),
  });

export const makeSignOutURL = () =>
  config.signOutUrl || /* istanbul ignore next */ '/';

export const adjustTokensForLatency = (tokens) => ({
  ...tokens,
  expires_at: tokens.expires_at - LATENCY_SECONDS,
});
