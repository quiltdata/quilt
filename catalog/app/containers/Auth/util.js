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

export const makeSignInURL = (path = getPath(window.location)) =>
  // TODO(dima): Sign up vs sign in?
  makeURL('/signin', {
    next: path === '/' ? '/profile' : path,
  });

export const makeSignOutURL = () => '/';
  // config.signOutUrl || [> istanbul ignore next <] '/';

export const adjustTokensForLatency = (tokens) => ({
  ...tokens,
  expires_at: tokens.expires_at - LATENCY_SECONDS,
});
