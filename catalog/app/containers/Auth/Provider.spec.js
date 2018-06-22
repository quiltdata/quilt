/* eslint-disable import/first */

import { mount } from 'enzyme';
import createHistory from 'history/createMemoryHistory';
import { fromJS } from 'immutable';
import invoke from 'lodash/fp/invoke';
import React from 'react';

import LanguageProvider from 'containers/LanguageProvider';
import { PUSH } from 'containers/Notifications/constants';
import { translationMessages as messages } from 'i18n';
import StoreProvider from 'utils/StoreProvider';
import configureStore from 'store';

import feature, { step } from 'testing/feature';

import {
  Provider as AuthProvider,
  makeHeaders,
} from '.';

jest.mock('constants/config', () => ({}));

jest.mock('utils/time');
import { timestamp } from 'utils/time';

import storeSteps from './tests/support/store';
import storageSteps from './tests/support/storage';
import requestsSteps from './tests/support/requests';
import {
  api,
  latency,
  date,
  tokensStale,
  tokens,
  tokensRaw,
  user,
  signInRedirect,
  signOutRedirect,
  checkOn,
} from './tests/support/fixtures';


const requests = {
  signUp: {
    setup: () => ['postOnce', '/register'],
    expect: (ctx) =>
      expect.objectContaining({
        body: JSON.stringify(ctx.credentials),
      }),
  },
  resetPassword: {
    setup: () => ['postOnce', '/reset_password'],
    expect: ({ email }) =>
      expect.objectContaining({
        body: JSON.stringify({ email }),
      }),
  },
  changePassword: {
    setup: () => ['postOnce', '/reset_password'],
    expect: ({ link, password }) =>
      expect.objectContaining({
        body: JSON.stringify({ link, password }),
      }),
  },
  getCode: {
    setup: () => ['getOnce', '/api/code'],
    expect: () =>
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: `Bearer ${tokens.token}`,
        }),
      }),
    success: () => ({ code: 'the code' }),
  },
  refreshTokens: {
    setup: () => ['postOnce', '/api/refresh'],
    expect: () =>
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: `Bearer ${tokensStale.token}`,
        }),
      }),
    success: () => tokensRaw,
  },
  signIn: {
    setup: () => ['postOnce', '/login'],
    expect: (ctx) =>
      expect.objectContaining({
        body: JSON.stringify(ctx.credentials),
      }),
    success: () => tokensRaw,
  },
  fetchUser: {
    setup: () => ['getOnce', '/api-root'],
    expect: () =>
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: `Bearer ${tokens.token}`,
        }),
      }),
    success: () => user,
  },
  signOut: {
    setup: () => ['postOnce', '/logout'],
    expect: () =>
      expect.objectContaining({
        body: JSON.stringify({ token: tokens.token }),
        headers: expect.objectContaining({
          Authorization: `Bearer ${tokens.token}`,
        }),
      }),
  },
};

const treeMounted = step(/the component tree is mounted/, (ctx) => {
  const history = createHistory({ initialEntries: ['/'] });
  const store = configureStore(fromJS({}), history);
  jest.spyOn(store, 'dispatch');
  const storage = ctx.storage || {
    load: () => ({}),
    set: () => {},
    remove: () => {},
  };
  const tree = (
    // we must wrap the tree into div, because enzyme doesn't support fragments
    // https://github.com/airbnb/enzyme/issues/1213
    <div>
      <StoreProvider store={store}>
        <LanguageProvider messages={messages}>
          <AuthProvider
            storage={storage}
            api={api}
            latency={latency}
            signInRedirect={signInRedirect}
            signOutRedirect={signOutRedirect}
            checkOn={checkOn}
          >
            <h1>test</h1>
          </AuthProvider>
        </LanguageProvider>
      </StoreProvider>
    </div>
  );
  timestamp.mockReturnValue(date);
  const mounted = mount(tree);
  return { ...ctx, history, store, tree, mounted };
});


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
  .then('resolve should be called')
  .then('reject should not be called')

  .back()
  .when('signUp request fails with 400, error: "Unacceptable username."')
  .then('reject should be called with InvalidUsername error')

  .back()
  .when('signUp request fails with 400, error: "Unacceptable email."')
  .then('reject should be called with InvalidEmail error')

  .back()
  .when('signUp request fails with 400, error: "Password must be ..."')
  .then('reject should be called with InvalidPassword error')

  .back()
  .when('signUp request fails with 409, error: "Username already taken."')
  .then('reject should be called with UsernameTaken error')

  .back()
  .when('signUp request fails with 409, error: "Email already taken."')
  .then('reject should be called with EmailTaken error')

  .back()
  .when('signUp request fails with 500')
  .then('reject should be called with AuthError error')


  .scenario('Dispatching resetPassword action')

  .given('resetPassword request is expected')
  .given('the component tree is mounted')

  .when('resetPassword action is dispatched')
  .then('resetPassword request should be made')

  .when('resetPassword request succeeds')
  .then('resolve should be called')
  .then('reject should not be called')

  .back()
  .when('resetPassword request fails with 500')
  .then('reject should be called with AuthError error')


  .scenario('Dispatching changePassword action')

  .given('changePassword request is expected')
  .given('the component tree is mounted')

  .when('changePassword action is dispatched')
  .then('changePassword request should be made')

  .when('changePassword request succeeds')
  .then('resolve should be called')
  .then('reject should not be called')

  .back()
  .when('changePassword request fails with 404, error: "User not found."')
  .then('reject should be called with InvalidResetLink error')

  .back()
  .when('changePassword request fails with 400, error: "Invalid link."')
  .then('reject should be called with InvalidResetLink error')

  .back()
  .when('changePassword request fails with 400, error: "Password must be ..."')
  .then('reject should be called with InvalidPassword error')

  .back()
  .when('changePassword request fails with 500')
  .then('reject should be called with AuthError error')


  .scenario('Dispatching getCode action')

  .given('storage has current auth data')
  .given('getCode request is expected')
  .given('the component tree is mounted')

  .when('getCode action is dispatched')
  .then('getCode request should be made')

  .when('getCode request succeeds')
  .then('resolve should be called with the received code')
  .then('reject should not be called')

  .back()
  .when('getCode request fails with 500')
  .then('reject should be called with AuthError error')
  .then('resolve should not be called')


  .steps([treeMounted, ...storageSteps, ...storeSteps, ...requestsSteps(requests)])

  .run();


feature('containers/Auth/Provider: signing in')
  .given('storage has empty auth data')
  .given('the component tree is mounted')
  .given('signIn request is expected')
  .given('fetchUser request is expected')


  .scenario('Signing in successfully')

  .when('signIn action is dispatched')
  .then('signIn request should be made')
  .then('store should be in signing-in state')

  .when('signIn request succeeds')
  .then('fetchUser request should be made')

  .when('fetchUser request succeeds')
  .then('tokens should be stored')
  .then('user data should be stored')
  .then('resolve should be called with tokens and user data')
  .then('reject should not be called')
  .then('store should be in signed-in state')


  .scenario('Signing in with invalid credentials')

  .when('signIn action is dispatched')
  .when('signIn request fails with 200, error: "Login attempt failed"')
  .then('reject should be called with InvalidCredentials error')
  .then('resolve should not be called')
  .then('store should be in signed-out state')


  .scenario('Signing in, sign-in request fails')

  .when('signIn action is dispatched')
  .when('signIn request fails with 500')
  .then('reject should be called with AuthError error')
  .then('resolve should not be called')
  .then('store should be in signed-out state')


  .scenario('Signing in, user request fails')

  .when('signIn action is dispatched')
  .when('signIn request succeeds')
  .when('fetchUser request fails with 500')
  .then('reject should be called with AuthError error')
  .then('resolve should not be called')
  .then('store should be in signed-out state')


  .steps([treeMounted, ...storageSteps, ...storeSteps, ...requestsSteps(requests)])

  .run();


feature('containers/Auth/Provider: signing out')
  .given('storage has current auth data')
  .given('the component tree is mounted')
  .given('signOut request is expected')


  .scenario('Signing out successfully')

  .when('signOut action is dispatched')
  .then('signOut request should be made')
  .then('store should be in signed-in state')

  .when('signOut request succeeds')
  .then('store should be in signed-out state')
  .then('tokens should be destroyed')
  .then('user data should be destroyed')
  .then('resolve should be called')
  .then('reject should not be called')


  .scenario('Signing out, sign-out request fails')

  .when('signOut action is dispatched')
  .when('signOut request fails with 400, error: "Logout failed."')
  .then('store should be in signed-out state')
  .then('tokens should be destroyed')
  .then('user data should be destroyed')
  .then('resolve should not be called')
  .then('reject should be called with AuthError error')


  .steps([treeMounted, ...storageSteps, ...storeSteps, ...requestsSteps(requests)])

  .run();


feature('containers/Auth/Provider: check')
  .given('refreshTokens request is expected')
  .given('fetchUser request is expected')


  .scenario('Dispatching check when tokens are current')

  .given('storage has current auth data')
  .given('the component tree is mounted')

  .when('check action is dispatched')
  .then('resolve should be called')
  .then('reject should not be called')


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
  .then('resolve should be called with tokens and user data')
  .then('reject should not be called')


  .scenario('Dispatching check without refetch when tokens are stale, requests succeed')

  .given('storage has stale auth data')
  .given('the component tree is mounted')

  .when('check (with refetch = false) action is dispatched')
  .when('refreshTokens request succeeds')
  .then('tokens should be stored')
  .then('store should be in signed-in state')
  .then('resolve should be called with tokens')
  .then('reject should not be called')


  .scenario('Dispatching check with refetch when tokens are stale, refreshTokens request succeeds, fetchUser request fails with 401')

  .given('storage has stale auth data')
  .given('the component tree is mounted')

  .when('check action is dispatched')
  .when('refreshTokens request succeeds')
  .when('fetchUser request fails with 401')
  .then('tokens should be destroyed')
  .then('user data should be destroyed')
  .then('"authentication lost" notification should be shown')
  .then('store should be in signed-out state with error')
  .then('resolve should not be called')
  .then('reject should be called with NotAuthenticated error')


  .scenario('Dispatching check without refetch when tokens are stale, refreshTokens request fails with 401')

  .given('storage has stale auth data')
  .given('the component tree is mounted')

  .when('check (with refetch = false) action is dispatched')
  .when('refreshTokens request fails with 401')
  .then('"authentication lost" notification should be shown')
  .then('store should be in signed-out state with error')
  .then('resolve should not be called')
  .then('reject should be called with NotAuthenticated error')

  .scenario('Dispatching check without refetch when tokens are stale, refreshTokens request fails with 500')

  .given('storage has stale auth data')
  .given('the component tree is mounted')

  .when('check (with refetch = false) action is dispatched')
  .when('refreshTokens request fails with 500')
  .then('"authentication error" notification should be shown')
  .then('store should be in signed-in state with stale tokens and error')
  .then('resolve should not be called')
  .then('reject should be called with AuthError error')


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

  .steps([treeMounted, ...storageSteps, ...storeSteps, ...requestsSteps(requests)])

  .run();


feature('containers/Auth/Provider: authLost')
  .scenario('Dispatching authLost')

  .given('storage has current auth data')
  .given('the component tree is mounted')

  .when('authLost action is dispatched')
  .then('store should be in signed-out state with error')
  .then('"authentication lost" notification should be shown')


  .steps([treeMounted, ...storageSteps, ...storeSteps])

  .step(/"authentication lost" notification should be shown/, (ctx) => {
    expect(ctx.store.dispatch).toBeCalledWith(expect.objectContaining({
      type: PUSH,
      notification: expect.objectContaining({
        message: expect.stringMatching(/Authentication lost/),
      }),
    }));
  })

  .run();


feature('containers/Auth/saga: makeHeaders()')
  .given('refreshTokens request is expected')

  .scenario('Requesting auth headers when auth data is absent')

  .given('storage has empty auth data')
  .given('the component tree is mounted')

  .when('the saga is run')
  .then('result should be an empty object')


  .scenario('Requesting auth headers when auth data is current')

  .given('storage has current auth data')
  .given('the component tree is mounted')

  .when('the saga is run')
  .then('result should be an object containing the proper auth header')

  .scenario('Requesting auth headers when auth data is stale and then gets refreshed successfully')

  .given('storage has stale auth data')
  .given('the component tree is mounted')

  .when('the saga is run')
  .then('refreshTokens request should be made')

  .when('refreshTokens request succeeds')
  .then('result should be an object containing the proper auth header')


  .scenario('Requesting auth headers when auth data is stale, refreshTokens request fails with 401')

  .given('storage has stale auth data')
  .given('the component tree is mounted')

  .when('the saga is run')
  .then('refreshTokens request should be made')

  .when('refreshTokens request fails with 401')
  .then('result should be an empty object')


  .scenario('Requesting auth headers when auth data is stale, refreshTokens request fails with 500')

  .given('storage has stale auth data')
  .given('the component tree is mounted')

  .when('the saga is run')
  .then('refreshTokens request should be made')

  .when('refreshTokens request fails with 500')
  .then('result should be an object containing the stale auth header')


  .steps([treeMounted, ...storageSteps, ...requestsSteps(requests)])

  .step(/the saga is run/, (ctx) => ({
    ...ctx,
    result: ctx.store.runSaga(makeHeaders).done,
  }))

  .step(/result should be an empty object/, async ({ result }) => {
    expect(await result).toEqual({});
  })

  .step(/result should be an object containing the proper auth header/, async ({ result }) => {
    expect(await result).toEqual({
      Authorization: `Bearer ${tokens.token}`,
    });
  })

  .step(/result should be an object containing the stale auth header/, async ({ result }) => {
    expect(await result).toEqual({
      Authorization: `Bearer ${tokensStale.token}`,
    });
  })

  .run();
