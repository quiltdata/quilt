import { createStructuredSelector } from 'reselect';

import { step } from 'testing/feature';

import {
  actions,
  errors,
  selectors,
} from '../..';

import {
  signInRedirect,
  signOutRedirect,
  user,
  tokens,
  tokensStale,
} from './fixtures';


const selector = createStructuredSelector({
  state: selectors.state,
  waiting: selectors.waiting,
  error: selectors.error,
  username: selectors.username,
  authenticated: selectors.authenticated,
  email: selectors.email,
  tokens: selectors.tokens,
  signInRedirect: selectors.signInRedirect,
  signOutRedirect: selectors.signOutRedirect,
});

const states = {
  'signing-in state': {
    state: 'SIGNING_IN',
    waiting: true,
    error: undefined,
    username: undefined,
    authenticated: false,
    email: undefined,
    tokens: {},
    signInRedirect,
    signOutRedirect,
  },

  'signed-in state': {
    state: 'SIGNED_IN',
    waiting: false,
    error: undefined,
    username: user.current_user,
    authenticated: true,
    email: user.email,
    tokens,
    signInRedirect,
    signOutRedirect,
  },

  'signed-in state with stale tokens': {
    state: 'SIGNED_IN',
    waiting: false,
    error: undefined,
    username: user.current_user,
    authenticated: true,
    email: user.email,
    tokens: tokensStale,
    signInRedirect,
    signOutRedirect,
  },

  'signed-in state with stale tokens and error': {
    state: 'SIGNED_IN',
    waiting: false,
    error: expect.any(Error),
    username: user.current_user,
    authenticated: true,
    email: user.email,
    tokens: tokensStale,
    signInRedirect,
    signOutRedirect,
  },

  'refreshing state': {
    state: 'REFRESHING',
    waiting: true,
    error: undefined,
    username: user.current_user,
    authenticated: true,
    email: user.email,
    tokens: tokensStale,
    signInRedirect,
    signOutRedirect,
  },

  'signed-out state': {
    state: 'SIGNED_OUT',
    waiting: false,
    error: undefined,
    username: undefined,
    authenticated: false,
    email: undefined,
    tokens: {},
    signInRedirect,
    signOutRedirect,
  },

  'signed-out state with error': {
    state: 'SIGNED_OUT',
    waiting: false,
    error: expect.any(Error),
    username: undefined,
    authenticated: false,
    email: undefined,
    tokens: {},
    signInRedirect,
    signOutRedirect,
  },
};

const resolves = {
  tokens: () => ({ tokens }),
  'tokens and user data': () => ({ user, tokens }),
  'the received code': (ctx) => ctx.requestResults.getCode.code,
};

const dispatches = {
  signUp: () => {
    const resolve = jest.fn();
    const reject = jest.fn();
    const credentials = {
      username: 'bob',
      email: 'bob@example.com',
      password: 's3cr3t',
    };
    return {
      action: actions.signUp(credentials, { resolve, reject }),
      expose: { credentials, resolve, reject },
    };
  },

  resetPassword: () => {
    const resolve = jest.fn();
    const reject = jest.fn();
    const email = 'bob@example.com';
    return {
      action: actions.resetPassword(email, { resolve, reject }),
      expose: { email, resolve, reject },
    };
  },

  changePassword: () => {
    const resolve = jest.fn();
    const reject = jest.fn();
    const link = 'test-link';
    const password = 'n3w!s3cr3t';
    return {
      action: actions.changePassword(link, password, { resolve, reject }),
      expose: { link, password, resolve, reject },
    };
  },

  getCode: () => {
    const resolve = jest.fn();
    const reject = jest.fn();
    return {
      action: actions.getCode({ resolve, reject }),
      expose: { resolve, reject },
    };
  },

  signIn: () => {
    const resolve = jest.fn();
    const reject = jest.fn();
    const credentials = { username: 'bob', password: 's3cr3t' };
    return {
      action: actions.signIn(credentials, { resolve, reject }),
      expose: { credentials, resolve, reject },
    };
  },

  signOut: () => {
    const resolve = jest.fn();
    const reject = jest.fn();
    return {
      action: actions.signOut({ resolve, reject }),
      expose: { resolve, reject },
    };
  },

  check: () => {
    const resolve = jest.fn();
    const reject = jest.fn();
    return {
      action: actions.check({}, { resolve, reject }),
      expose: { resolve, reject },
    };
  },

  'check (with refetch = false)': () => {
    const resolve = jest.fn();
    const reject = jest.fn();
    return {
      action: actions.check({ refetch: false }, { resolve, reject }),
      expose: { resolve, reject },
    };
  },

  authLost: () => ({ action: actions.authLost(new Error('test')) }),
};

export default [
  step(/store should be in (.*)$/, (ctx, state) => {
    expect(selector(ctx.store.getState())).toEqual(states[state]);
  }),

  step(/(.*) action is dispatched/, (ctx, type) => {
    const { expose, action } = dispatches[type](ctx);
    ctx.store.dispatch(action);
    return { ...ctx, ...expose };
  }),

  step(/resolve should be called$/, (ctx) => {
    expect(ctx.resolve).toBeCalled();
  }),

  step(/resolve should not be called/, (ctx) => {
    expect(ctx.resolve).not.toBeCalled();
  }),

  step(/resolve should be called with (.*)$/, (ctx, resolve) => {
    expect(ctx.resolve).toBeCalledWith(resolves[resolve](ctx));
  }),

  step(/reject should be called$/, (ctx) => {
    expect(ctx.reject).toBeCalled();
  }),

  step(/reject should not be called/, (ctx) => {
    expect(ctx.reject).not.toBeCalled();
  }),

  step(/reject should be called with (.*) error/, (ctx, type) => {
    expect(ctx.reject).toBeCalledWith(expect.any(errors[type]));
  }),
];
