import { stringify } from 'query-string';

import { LATENCY_SECONDS } from './constants';

export const makeHeadersFromTokens = ({ token }) => ({
  Authorization: `Bearer ${token}`,
});

const makeURL = (url, query) => {
  const qs = stringify(query);
  const search = qs ? `?${qs}` : '';
  return `${url}${search}`;
};

const getPath = (loc) => loc.pathname + loc.search;

export const makeSignInURL = (next = getPath(window.location)) =>
  // TODO(dima): Sign up vs sign in?
  makeURL('/signin', { next });

export const adjustTokensForLatency = (tokens) => ({
  ...tokens,
  expires_at:
    Number.isFinite(tokens.expires_at)
      ? tokens.expires_at - LATENCY_SECONDS
      : tokens.expires_at,
});
