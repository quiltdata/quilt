import createHistory from 'history/createMemoryHistory';
import { fromJS } from 'immutable';
import invoke from 'lodash/fp/invoke';
import React from 'react';
import { createStructuredSelector } from 'reselect';

import LanguageProvider from 'containers/LanguageProvider';
import { PUSH } from 'containers/Notifications/constants';
import { translationMessages as messages } from 'i18n';
import { Provider as APIProvider, apiRequest } from 'utils/APIConnector';
import { nest } from 'utils/reactTools';
import StoreProvider from 'utils/StoreProvider';
import { timestamp } from 'utils/time';
import configureStore from 'store';

import feature from 'testing/feature';
import callsSteps from 'testing/calls';
import reactSteps from 'testing/react';
import reduxSteps from 'testing/redux';
import requestsSteps from 'testing/requests';
import storageSteps from 'testing/storage';

import {
  Provider as AuthProvider,
  actions,
  errors,
  selectors,
  apiMiddleware,
  getTokens,
} from '..';

import {
  api,
  latency,
  date,
  tokens,
  tokensRaw,
  tokensStale,
  user,
  signInRedirect,
  signOutRedirect,
  checkOn,
  datasets,
  storageObjects,
} from './fixtures';

jest.mock('constants/config');
jest.mock('utils/time');


const headerJson = {
  Accepts: 'application/json',
  'Content-Type': 'application/json',
};
const headerAuth = {
  Authorization: `Bearer ${tokens.token}`,
};
const headerAuthStale = {
  Authorization: `Bearer ${tokensStale.token}`,
};

const requests = {
  signUp: {
    setup: () => ['postOnce', '/register'],
    expect: (ctx) =>
      expect.objectContaining({
        body: JSON.stringify(ctx.action.payload),
        headers: headerJson,
      }),
  },
  resetPassword: {
    setup: () => ['postOnce', '/reset_password'],
    expect: (ctx) =>
      expect.objectContaining({
        body: JSON.stringify({ email: ctx.action.payload }),
        headers: headerJson,
      }),
  },
  changePassword: {
    setup: () => ['postOnce', '/change_password'],
    expect: (ctx) =>
      expect.objectContaining({
        body: JSON.stringify(ctx.action.payload),
        headers: headerJson,
      }),
  },
  getCode: {
    setup: () => ['getOnce', '/code'],
    expect: () =>
      expect.objectContaining({
        headers: expect.objectContaining({
          ...headerAuth,
          ...headerJson,
        }),
      }),
    success: () => ({ code: 'the code' }),
  },
  refreshTokens: {
    setup: () => ['postOnce', '/refresh'],
    expect: () =>
      expect.objectContaining({
        headers: expect.objectContaining({
          ...headerAuthStale,
          ...headerJson,
        }),
      }),
    success: () => tokensRaw,
  },
  signIn: {
    setup: () => ['postOnce', '/login'],
    expect: (ctx) =>
      expect.objectContaining({
        body: JSON.stringify(ctx.action.payload),
        headers: headerJson,
      }),
    success: () => tokensRaw,
  },
  fetchUser: {
    setup: () => ['getOnce', '/me'],
    expect: () =>
      expect.objectContaining({
        headers: expect.objectContaining({
          ...headerAuth,
          ...headerJson,
        }),
      }),
    success: () => user,
  },
  signOut: {
    setup: () => ['postOnce', '/logout'],
    expect: () =>
      expect.objectContaining({
        headers: expect.objectContaining({
          ...headerAuth,
          ...headerJson,
        }),
      }),
  },
  getData: {
    setup: () => ['get', '/data'],
  },
};

const mkResolver = () => ({
  resolve: jest.fn(),
  reject: jest.fn(),
});

const dispatches = {
  signUp: () =>
    actions.signUp({
      username: 'bob',
      email: 'bob@example.com',
      password: 's3cr3t',
    }, mkResolver()),

  resetPassword: () =>
    actions.resetPassword('bob@example.com', mkResolver()),

  changePassword: () =>
    actions.changePassword('test-link', 'n3w!s3cr3t', mkResolver()),

  getCode: () => actions.getCode(mkResolver()),

  signIn: () =>
    actions.signIn({ username: 'bob', password: 's3cr3t' }, mkResolver()),

  signOut: () => actions.signOut(mkResolver()),

  check: () => actions.check({}, mkResolver()),

  'check (with refetch = false)': () =>
    actions.check({ refetch: false }, mkResolver()),

  authLost: () => actions.authLost(new Error('test')),
};

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
  'signing-in': {
    state: 'SIGNING_IN',
    waiting: true,
    error: undefined,
    username: undefined,
    authenticated: false,
    email: undefined,
    tokens: undefined,
    signInRedirect,
    signOutRedirect,
  },

  'signed-in': {
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

  'signed-in with stale tokens': {
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

  'signed-in with stale tokens and error': {
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

  refreshing: {
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

  'signed-out': {
    state: 'SIGNED_OUT',
    waiting: false,
    error: undefined,
    username: undefined,
    authenticated: false,
    email: undefined,
    tokens: undefined,
    signInRedirect,
    signOutRedirect,
  },

  'signed-out with error': {
    state: 'SIGNED_OUT',
    waiting: false,
    error: expect.any(Error),
    username: undefined,
    authenticated: false,
    email: undefined,
    tokens: undefined,
    signInRedirect,
    signOutRedirect,
  },
};

const argumentsMap = {
  tokens: () => [{ tokens }],
  'tokens and user data': () => [{ user, tokens }],
  'the received code': (ctx) => [ctx.requestResults.getCode.code],
  'InvalidUsername error': () => [expect.any(errors.InvalidUsername)],
  'InvalidEmail error': () => [expect.any(errors.InvalidEmail)],
  'InvalidPassword error': () => [expect.any(errors.InvalidPassword)],
  'UsernameTaken error': () => [expect.any(errors.UsernameTaken)],
  'EmailTaken error': () => [expect.any(errors.EmailTaken)],
  'InvalidResetLink error': () => [expect.any(errors.InvalidResetLink)],
  'InvalidCredentials error': () => [expect.any(errors.InvalidCredentials)],
  'InvalidToken error': () => [expect.any(errors.InvalidToken)],
  AuthError: () => [expect.any(errors.AuthError)],
};

const mockStorage = () => ({
  load: () => ({}),
  set: () => {},
  remove: () => {},
});

const setup = ({ storage, fetch = () => {} }) => {
  const history = createHistory({ initialEntries: ['/'] });
  const store = configureStore(fromJS({}), history);
  jest.spyOn(store, 'dispatch');
  const tree = nest(
    [StoreProvider, { store }],
    [LanguageProvider, { messages }],
    [APIProvider, { base: api, fetch, middleware: [apiMiddleware] }],
    [AuthProvider, {
      storage: storage || mockStorage(),
      latency,
      signInRedirect,
      signOutRedirect,
      checkOn,
    }],
    () => <h1>test</h1>,
  );
  timestamp.mockReturnValue(date);
  return { store, tree };
};

const treeSteps = reactSteps({ setup });


feature('containers/Auth/Provider')
  .scenario('Initializing the provider when storage has current data')
  .given('storage has current auth data')
  .when('the component tree is mounted')
  .then('store should be in signed-in state')

  .scenario('Initializing the provider when storage has stale data')
  .given('storage has stale auth data')
  .when('the component tree is mounted')
  .then('store should be in signed-in state with stale tokens')

  .scenario('Initializing the provider when storage has no data')
  .given('storage has empty auth data')
  .when('the component tree is mounted')
  .then('store should be in signed-out state')

  .scenario('Intercepting "checkOn" action')
  .given('refreshTokens request is expected')
  .given('storage has stale auth data')
  .given('the component tree is mounted')
  .when('dispatching action that will be caught by "checkOn"')
  .then('store should be in refreshing state')

  .step(/dispatching action that will be caught by "checkOn"/, (ctx) => {
    ctx.store.dispatch({ type: checkOn });
  })

  .scenario('Dispatching signUp action')
  .given('signUp request is expected')
  .given('the component tree is mounted')

  .when('signUp action is dispatched')
  .then('signUp request should be made')

  .when('signUp request succeeds')
  .then('action.meta.resolve should be called')
  .then('action.meta.reject should not be called')

  .back()
  .when('signUp request fails with 400, message: "Unacceptable username."')
  .then('action.meta.reject should be called with InvalidUsername error')

  .back()
  .when('signUp request fails with 400, message: "Unacceptable email."')
  .then('action.meta.reject should be called with InvalidEmail error')

  .back()
  .when('signUp request fails with 400, message: "Password must be ..."')
  .then('action.meta.reject should be called with InvalidPassword error')

  .back()
  .when('signUp request fails with 409, message: "Username already taken."')
  .then('action.meta.reject should be called with UsernameTaken error')

  .back()
  .when('signUp request fails with 409, message: "Email already taken."')
  .then('action.meta.reject should be called with EmailTaken error')

  .back()
  .when('signUp request fails with 500')
  .then('action.meta.reject should be called with AuthError')


  .scenario('Dispatching resetPassword action')

  .given('resetPassword request is expected')
  .given('the component tree is mounted')

  .when('resetPassword action is dispatched')
  .then('resetPassword request should be made')

  .when('resetPassword request succeeds')
  .then('action.meta.resolve should be called')
  .then('action.meta.reject should not be called')

  .back()
  .when('resetPassword request fails with 500')
  .then('action.meta.reject should be called with AuthError')


  .scenario('Dispatching changePassword action')

  .given('changePassword request is expected')
  .given('the component tree is mounted')

  .when('changePassword action is dispatched')
  .then('changePassword request should be made')

  .when('changePassword request succeeds')
  .then('action.meta.resolve should be called')
  .then('action.meta.reject should not be called')

  .back()
  .when('changePassword request fails with 404, error: "User not found."')
  .then('action.meta.reject should be called with InvalidResetLink error')

  .back()
  .when('changePassword request fails with 401, error: "Reset token invalid."')
  .then('action.meta.reject should be called with InvalidResetLink error')

  .back()
  .when('changePassword request fails with 400, message: "Password must be ..."')
  .then('action.meta.reject should be called with InvalidPassword error')

  .back()
  .when('changePassword request fails with 500')
  .then('action.meta.reject should be called with AuthError')


  .scenario('Dispatching getCode action')

  .given('storage has current auth data')
  .given('getCode request is expected')
  .given('the component tree is mounted')

  .when('getCode action is dispatched')
  .then('getCode request should be made')

  .when('getCode request succeeds')
  .then('action.meta.resolve should be called with the received code')
  .then('action.meta.reject should not be called')

  .back()
  .when('getCode request fails with 500')
  .then('action.meta.reject should be called with AuthError')
  .then('action.meta.resolve should not be called')


  .steps([
    ...treeSteps,
    ...storageSteps(datasets, storageObjects),
    ...reduxSteps({ dispatches, states, selector }),
    ...requestsSteps(api, requests),
    ...callsSteps(argumentsMap),
  ])

  .run();


feature('containers/Auth/Provider: signing in')
  .given('storage has empty auth data')
  .given('signIn request is expected')
  .given('fetchUser request is expected')
  .given('the component tree is mounted')


  .scenario('Signing in successfully')

  .when('signIn action is dispatched')
  .then('signIn request should be made')
  .then('store should be in signing-in state')

  .when('signIn request succeeds')
  .then('fetchUser request should be made')

  .when('fetchUser request succeeds')
  .then('tokens should be stored')
  .then('user data should be stored')
  .then('action.meta.resolve should be called with tokens and user data')
  .then('action.meta.reject should not be called')
  .then('store should be in signed-in state')


  .scenario('Signing in with invalid credentials')

  .when('signIn action is dispatched')
  .when('signIn request fails with 401')
  .then('action.meta.reject should be called with InvalidCredentials error')
  .then('action.meta.resolve should not be called')
  .then('store should be in signed-out state')


  .scenario('Signing in, sign-in request fails')

  .when('signIn action is dispatched')
  .when('signIn request fails with 500')
  .then('action.meta.reject should be called with AuthError')
  .then('action.meta.resolve should not be called')
  .then('store should be in signed-out state')


  .scenario('Signing in, user request fails')

  .when('signIn action is dispatched')
  .when('signIn request succeeds')
  .when('fetchUser request fails with 500')
  .then('action.meta.reject should be called with AuthError')
  .then('action.meta.resolve should not be called')
  .then('store should be in signed-out state')


  .steps([
    ...treeSteps,
    ...storageSteps(datasets, storageObjects),
    ...reduxSteps({ dispatches, states, selector }),
    ...requestsSteps(api, requests),
    ...callsSteps(argumentsMap),
  ])

  .run();


feature('containers/Auth/Provider: signing out')
  .given('storage has current auth data')
  .given('signOut request is expected')
  .given('the component tree is mounted')


  .scenario('Signing out successfully')

  .when('signOut action is dispatched')
  .then('signOut request should be made')
  .then('store should be in signed-in state')

  .when('signOut request succeeds')
  .then('store should be in signed-out state')
  .then('tokens should be removed from storage')
  .then('user data should be removed from storage')
  .then('action.meta.resolve should be called')
  .then('action.meta.reject should not be called')


  .scenario('Signing out, sign-out request fails')

  .when('signOut action is dispatched')
  .when('signOut request fails with 400, error: "Logout failed."')
  .then('store should be in signed-out state')
  .then('tokens should be removed from storage')
  .then('user data should be removed from storage')
  .then('action.meta.resolve should not be called')
  .then('action.meta.reject should be called with AuthError')


  .steps([
    ...treeSteps,
    ...storageSteps(datasets, storageObjects),
    ...reduxSteps({ dispatches, states, selector }),
    ...requestsSteps(api, requests),
    ...callsSteps(argumentsMap),
  ])

  .run();


feature('containers/Auth/Provider: check')
  .given('refreshTokens request is expected')
  .given('fetchUser request is expected')


  .scenario('Dispatching check when tokens are current')

  .given('storage has current auth data')
  .given('the component tree is mounted')

  .when('check action is dispatched')
  .then('action.meta.resolve should be called')
  .then('action.meta.reject should not be called')


  .scenario('Dispatching check with refetch when tokens are stale, requests succeed')

  .given('storage has stale auth data')
  .given('the component tree is mounted')

  .when('check action is dispatched')
  .then('store should be in refreshing state')
  .then('refreshTokens request should be made')

  .when('refreshTokens request succeeds')
  .then('tokens should be stored')
  .then('fetchUser request should be made')

  .when('fetchUser request succeeds')
  .then('store should be in signed-in state')
  .then('action.meta.resolve should be called with tokens and user data')
  .then('action.meta.reject should not be called')


  .scenario('Dispatching check without refetch when tokens are stale, requests succeed')

  .given('storage has stale auth data')
  .given('the component tree is mounted')

  .when('check (with refetch = false) action is dispatched')
  .when('refreshTokens request succeeds')
  .then('tokens should be stored')
  .then('store should be in signed-in state')
  .then('action.meta.resolve should be called with tokens')
  .then('action.meta.reject should not be called')


  .scenario('Dispatching check with refetch when tokens are stale, refreshTokens request succeeds, fetchUser request fails with 401')

  .given('storage has stale auth data')
  .given('the component tree is mounted')

  .when('check action is dispatched')
  .when('refreshTokens request succeeds')
  .when('fetchUser request fails with 401')
  .then('tokens should be removed from storage')
  .then('user data should be removed from storage')
  .then('"authentication lost" notification should be shown')
  .then('store should be in signed-out state with error')
  .then('action.meta.resolve should not be called')
  .then('action.meta.reject should be called with InvalidToken error')


  .scenario('Dispatching check without refetch when tokens are stale, refreshTokens request fails with 401')

  .given('storage has stale auth data')
  .given('the component tree is mounted')

  .when('check (with refetch = false) action is dispatched')
  .when('refreshTokens request fails with 401')
  .then('"authentication lost" notification should be shown')
  .then('store should be in signed-out state with error')
  .then('action.meta.resolve should not be called')
  .then('action.meta.reject should be called with InvalidToken error')

  .scenario('Dispatching check without refetch when tokens are stale, refreshTokens request fails with 500')

  .given('storage has stale auth data')
  .given('the component tree is mounted')

  .when('check (with refetch = false) action is dispatched')
  .when('refreshTokens request fails with 500')
  .then('"authentication error" notification should be shown')
  .then('store should be in signed-in state with stale tokens and error')
  .then('action.meta.resolve should not be called')
  .then('action.meta.reject should be called with AuthError')


  .step(/"authentication (.*)" notification should be shown/, (ctx, type) => {
    const re = invoke(type, {
      lost: () => /Authentication lost/,
      error: () => /Authentication error/,
    });

    expect(ctx.store.dispatch).toBeCalledWith(expect.objectContaining({
      type: PUSH,
      notification: expect.objectContaining({
        message: expect.stringMatching(re),
      }),
    }));
  })

  .steps([
    ...treeSteps,
    ...storageSteps(datasets, storageObjects),
    ...reduxSteps({ dispatches, states, selector }),
    ...requestsSteps(api, requests),
    ...callsSteps(argumentsMap),
  ])

  .run();


feature('containers/Auth/saga: getTokens()')
  .given('refreshTokens request is expected')

  .scenario('Requesting auth tokens when auth data is absent')

  .given('storage has empty auth data')
  .given('the component tree is mounted')

  .when('the saga is run')
  .then('result should be undefined')


  .scenario('Requesting auth tokens when auth data is current')

  .given('storage has current auth data')
  .given('the component tree is mounted')

  .when('the saga is run')
  .then('result should be an object containing the proper auth tokens')

  .scenario('Requesting auth tokens when auth data is stale and then gets refreshed successfully')

  .given('storage has stale auth data')
  .given('the component tree is mounted')

  .when('the saga is run')
  .then('refreshTokens request should be made')

  .when('refreshTokens request succeeds')
  .then('result should be an object containing the proper auth tokens')


  .scenario('Requesting auth tokens when auth data is stale, refreshTokens request fails with 401')

  .given('storage has stale auth data')
  .given('the component tree is mounted')

  .when('the saga is run')
  .then('refreshTokens request should be made')

  .when('refreshTokens request fails with 401')
  .then('result should be undefined')


  .scenario('Requesting auth tokens when auth data is stale, refreshTokens request fails with 500')

  .given('storage has stale auth data')
  .given('the component tree is mounted')

  .when('the saga is run')
  .then('refreshTokens request should be made')

  .when('refreshTokens request fails with 500')
  .then('result should be an object containing the stale auth tokens')


  .step(/the saga is run/, (ctx) => ({
    ...ctx,
    result: ctx.store.runSaga(getTokens).done,
  }))

  .step(/result should be undefined/, async ({ result }) => {
    expect(await result).toBeUndefined();
  })

  .step(/result should be an object containing the proper auth tokens/, async ({ result }) => {
    expect(await result).toEqual(tokens);
  })

  .step(/result should be an object containing the stale auth tokens/, async ({ result }) => {
    expect(await result).toEqual(tokensStale);
  })

  .steps([
    ...treeSteps,
    ...storageSteps(datasets, storageObjects),
    ...requestsSteps(api, requests),
  ])

  .run();


feature('containers/Auth: authenticated request')
  .scenario('Making an authenticated request')

  .given('storage has current auth data')
  .given('getData request is expected')
  .given('the component tree is mounted')

  .when('getData request is made')
  .when('getData request fails with 401, message: "Token invalid."')
  .then('store should be in signed-out state with error')
  .then('"authentication lost" notification should be shown')

  .step(/getData request is made/, (ctx) => {
    ctx.store.runSaga(apiRequest, '/data');
  })

  .step(/"authentication lost" notification should be shown/, (ctx) => {
    expect(ctx.store.dispatch).toBeCalledWith(expect.objectContaining({
      type: PUSH,
      notification: expect.objectContaining({
        message: expect.stringMatching(/Authentication lost/),
      }),
    }));
  })

  .steps([
    ...treeSteps,
    ...storageSteps(datasets, storageObjects),
    ...reduxSteps({ dispatches, states, selector }),
    ...requestsSteps(api, requests),
  ])

  .run();
