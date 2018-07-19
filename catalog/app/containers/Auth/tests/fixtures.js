import { adjustTokensForLatency } from '../saga';


export const api = 'https://api';

export const latency = 10;

const unit = 100000; // ~ a day
export const date = new Date('2018-01-01T12:00:00Z').getTime() / 1000; // 1514808000

export const tokensStaleRaw = {
  token: 'ACCESS1',
  exp: date - unit,
};

export const tokensRaw = {
  token: 'ACCESS2',
  exp: date + unit,
};

export const tokensStale = adjustTokensForLatency(tokensStaleRaw, latency);
export const tokens = adjustTokensForLatency(tokensRaw, latency);

export const user = {
  current_user: 'admin',
  email: 'admin@localhost',
  is_active: true,
  is_staff: true,
};

export const datasets = {
  'empty auth': { tokens: null, user: null },
  'current auth': { tokens, user },
  'stale auth': { tokens: tokensStale, user },
};

export const storageObjects = {
  tokens: {
    key: 'tokens',
    value: tokens,
  },
  'user data': {
    key: 'user',
    value: user,
  },
};

export const signInRedirect = '/after-sign-in';
export const signOutRedirect = '/after-sign-out';

export const checkOn = '@@CHECK_ON';
