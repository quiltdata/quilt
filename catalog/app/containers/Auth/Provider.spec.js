/* eslint-disable import/first */

import { mount } from 'enzyme';
import fetchMock from 'fetch-mock';
import createHistory from 'history/createMemoryHistory';
import { fromJS } from 'immutable';
import invoke from 'lodash/fp/invoke';
import React from 'react';
// import { Switch, Route } from 'react-router-dom';
// import { LOCATION_CHANGE } from 'react-router-redux';
import { createStructuredSelector } from 'reselect';

import LanguageProvider from 'containers/LanguageProvider';
// import Notifications from 'containers/Notifications';
import { translationMessages as messages } from 'i18n';
import defer from 'utils/defer';
import StoreProvider from 'utils/StoreProvider';
import configureStore from 'store';

import feature, { step } from 'testing/feature';
// import feature from 'testing/feature';
import {
  // findMockComponent,
  flushPromises,
  // getLocation,
  // mockComponent,
  spyOnDispatch,
} from 'testing/util';

import {
  Provider as AuthProvider,
  actions,
  errors,
  selectors,
  // makeHeaders,
} from '.';
import { adjustTokensForLatency } from './saga';

jest.mock('constants/config', () => ({}));

jest.mock('utils/time');
import { timestamp } from 'utils/time';


const api = 'https://api';

const latency = 10;

const unit = 100000; // ~ a day
const date = new Date('2018-01-01T12:00:00Z').getTime() / 1000; // 1514808000

const tokensStaleRaw = {
  token: 'ACCESS1',
  exp: date - unit,
};

const tokensRaw = {
  token: 'ACCESS2',
  exp: date + unit,
};

const tokensStale = adjustTokensForLatency(tokensStaleRaw, latency);
const tokens = adjustTokensForLatency(tokensRaw, latency);

const user = {
  current_user: 'admin',
  email: 'admin@localhost',
  is_active: true,
  is_staff: true,
};
const dataSets = {
  empty: { tokens: null, user: null },
  current: { tokens, user },
  stale: { tokens: tokensStale, user },
};

const signInRedirect = '/after-sign-in';
const signOutRedirect = '/after-sign-out';

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

const treeMounted = step(/the component tree is mounted/, (ctx) => {
  const history = createHistory({ initialEntries: ['/'] });
  const store = configureStore(fromJS({}), history);
  store.dispatchSpy = spyOnDispatch(store);
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

const storageHasData = step(/storage has (current|stale|empty) auth data/, (ctx, dataSet) => ({
  ...ctx,
  storage: {
    set: jest.fn(),
    remove: jest.fn(),
    load: jest.fn(() => dataSets[dataSet]),
  },
}));


feature('containers/Auth/Provider')
  .scenario('Initializing the provider when storage has current data')
  .given('storage has current auth data')
  .when('the component tree is mounted')
  .then('the provider should be initialized with the signed-in state')

  .scenario('Initializing the provider when storage has stale data')
  .given('storage has stale auth data')
  .when('the component tree is mounted')
  .then('the provider should be initialized with the signed-in state with stale tokens')

  .scenario('Initializing the provider when storage has no data')
  .given('storage has empty auth data')
  .when('the component tree is mounted')
  .then('the provider should be initialized with the signed-out state')

  .step(/the provider should be initialized with the signed-in state$/, (ctx) => {
    expect(selector(ctx.store.getState())).toEqual({
      state: 'SIGNED_IN',
      waiting: false,
      error: undefined,
      username: user.current_user,
      authenticated: true,
      email: user.email,
      tokens,
      signInRedirect,
      signOutRedirect,
    });
  })

  .step(/the provider should be initialized with the signed-in state with stale tokens/, (ctx) => {
    expect(selector(ctx.store.getState())).toEqual({
      state: 'SIGNED_IN',
      waiting: false,
      error: undefined,
      username: user.current_user,
      authenticated: true,
      email: user.email,
      tokens: tokensStale,
      signInRedirect,
      signOutRedirect,
    });
  })

  .step(/the provider should be initialized with the signed-out state/, (ctx) => {
    expect(selector(ctx.store.getState())).toEqual({
      state: 'SIGNED_OUT',
      waiting: false,
      error: undefined,
      username: undefined,
      authenticated: false,
      email: undefined,
      tokens: {},
      signInRedirect,
      signOutRedirect,
    });
  })


  .scenario('Dispatching signUp action')
  .given('signUp request is expected')
  .given('the component tree is mounted')

  .when('signUp action is dispatched')
  .then('signUp request should be made')

  .when('signUp request is resolved')
  .then('resolve should be called')
  .then('reject should not be called')

  .back()
  .when('signUp request is rejected with an "invalid username" error')
  .then('reject should be called with an "InvalidUsername" error instance')

  .back()
  .when('signUp request is rejected with an "invalid email" error')
  .then('reject should be called with an "InvalidEmail" error instance')

  .back()
  .when('signUp request is rejected with an "invalid password" error')
  .then('reject should be called with an "InvalidPassword" error instance')

  .back()
  .when('signUp request is rejected with a "username taken" error')
  .then('reject should be called with a "UsernameTaken" error instance')

  .back()
  .when('signUp request is rejected with an "email taken" error')
  .then('reject should be called with an "EmailTaken" error instance')

  .back()
  .when('signUp request is rejected with an unexpected error')
  .then('reject should be called with an "AuthError" instance')


  .scenario('Dispatching resetPassword action')

  .given('resetPassword request is expected')
  .given('the component tree is mounted')

  .when('resetPassword action is dispatched')
  .then('resetPassword request should be made')

  .when('resetPassword request is resolved')
  .then('resolve should be called')
  .then('reject should not be called')

  .back()
  .when('resetPassword request is rejected with an unexpected error')
  .then('reject should be called with an "AuthError" instance')


  .scenario('Dispatching changePassword action')

  .given('resetPassword request is expected')
  .given('the component tree is mounted')

  .when('changePassword action is dispatched')
  .then('changePassword request should be made')

  .when('changePassword request is resolved')
  .then('resolve should be called')
  .then('reject should not be called')

  .back()
  .when('changePassword request is rejected with an "user not found" error')
  .then('reject should be called with an "InvalidResetLink" error instance')

  .back()
  .when('changePassword request is rejected with an "invalid link" error')
  .then('reject should be called with an "InvalidResetLink" error instance')

  .back()
  .when('changePassword request is rejected with an "invalid password" error')
  .then('reject should be called with an "InvalidPassword" error instance')


  .scenario('Dispatching getCode action')

  .given('storage has current auth data')
  .given('getCode request is expected')
  .given('the component tree is mounted')

  .when('getCode action is dispatched')
  .then('getCode request should be made')

  .when('getCode request is resolved')
  .then('resolve should be called with the recevied code')
  .then('reject should not be called')

  .step(/signUp request is expected/, (ctx) => {
    const result = defer();
    fetchMock.postOnce(`${api}/register`, result.promise);
    return { ...ctx, requestResolver: result.resolver };
  }, () => {
    fetchMock.restore();
  })

  .step(/signUp action is dispatched/, (ctx) => {
    const resolve = jest.fn();
    const reject = jest.fn();
    const credentials = {
      username: 'bob',
      email: 'bob@example.com',
      password: 's3cr3t',
    };
    ctx.store.dispatch(actions.signUp(credentials, { resolve, reject }));
    return { ...ctx, credentials, resolve, reject };
  })

  .step(/signUp request should be made/, (ctx) => {
    expect(fetchMock.done()).toBe(true);
    expect(fetchMock.lastOptions()).toEqual(expect.objectContaining({
      body: JSON.stringify(ctx.credentials),
    }));
  })

  .step(/signUp request is resolved/, async (ctx) => {
    ctx.requestResolver.resolve({ sendAsJson: false });
    await flushPromises();
  })

  .step(/signUp request is rejected with an? (".*"|unexpected)/, async (ctx, responseError) => {
    const [status, error] = invoke(responseError, {
      '"invalid username"': () => [400, 'Unacceptable username.'],
      '"invalid email"': () => [400, 'Unacceptable email.'],
      '"invalid password"': () => [400, 'Password must be ...'],
      '"username taken"': () => [409, 'Username already taken.'],
      '"email taken"': () => [409, 'Email already taken.'],
      unexpected: () => [500, 'error'],
    });
    ctx.requestResolver.resolve({ status, body: { error } });
    await flushPromises();
  })

  .step(/resetPassword request is expected/, (ctx) => {
    const result = defer();
    fetchMock.postOnce(`${api}/reset_password`, result.promise);
    return { ...ctx, requestResolver: result.resolver };
  }, () => {
    fetchMock.restore();
  })

  .step(/resetPassword action is dispatched/, (ctx) => {
    const resolve = jest.fn();
    const reject = jest.fn();
    const email = 'bob@example.com';
    ctx.store.dispatch(actions.resetPassword(email, { resolve, reject }));
    return { ...ctx, email, resolve, reject };
  })

  .step(/resetPassword request should be made/, (ctx) => {
    expect(fetchMock.done()).toBe(true);
    expect(fetchMock.lastOptions()).toEqual(expect.objectContaining({
      body: JSON.stringify({ email: ctx.email }),
    }));
  })

  .step(/resetPassword request is resolved/, async (ctx) => {
    ctx.requestResolver.resolve({ sendAsJson: false });
    await flushPromises();
  })

  .step(/resetPassword request is rejected with an? (".*"|unexpected)/, async (ctx, responseError) => {
    const [status, error] = invoke(responseError, {
      unexpected: () => [500, 'error'],
    });
    ctx.requestResolver.resolve({ status, body: { error } });
    await flushPromises();
  })

  .step(/changePassword request is expected/, (ctx) => {
    const result = defer();
    fetchMock.postOnce(`${api}/reset_password`, result.promise);
    return { ...ctx, requestResolver: result.resolver };
  }, () => {
    fetchMock.restore();
  })

  .step(/changePassword action is dispatched/, (ctx) => {
    const resolve = jest.fn();
    const reject = jest.fn();
    const link = 'test-link';
    const password = 'n3w!s3cr3t';
    ctx.store.dispatch(actions.changePassword(link, password, { resolve, reject }));
    return { ...ctx, link, password, resolve, reject };
  })

  .step(/changePassword request should be made/, ({ link, password }) => {
    expect(fetchMock.done()).toBe(true);
    expect(fetchMock.lastOptions()).toEqual(expect.objectContaining({
      body: JSON.stringify({ link, password }),
    }));
  })

  .step(/changePassword request is resolved/, async (ctx) => {
    ctx.requestResolver.resolve({ sendAsJson: false });
    await flushPromises();
  })

  .step(/changePassword request is rejected with an? (".*"|unexpected)/, async (ctx, responseError) => {
    const [status, error] = invoke(responseError, {
      '"user not found"': () => [404, 'User not found.'],
      '"invalid link"': () => [400, 'Invalid link.'],
      '"invalid password"': () => [400, 'Password must be ...'],
      unexpected: () => [500, 'error'],
    });
    ctx.requestResolver.resolve({ status, body: { error } });
    await flushPromises();
  })

  .step(/getCode request is expected/, (ctx) => {
    const result = defer();
    fetchMock.getOnce(`${api}/api/code`, result.promise);
    return { ...ctx, requestResolver: result.resolver };
  }, () => {
    fetchMock.restore();
  })

  .step(/getCode action is dispatched/, (ctx) => {
    const resolve = jest.fn();
    const reject = jest.fn();
    ctx.store.dispatch(actions.getCode({ resolve, reject }));
    return { ...ctx, resolve, reject };
  })

  .step(/getCode request should be made/, () => {
    expect(fetchMock.done()).toBe(true);
    expect(fetchMock.lastOptions()).toEqual(expect.objectContaining({
      headers: expect.objectContaining({
        Authorization: `Bearer ${tokens.token}`,
      }),
    }));
  })

  .step(/getCode request is resolved/, async (ctx) => {
    const code = 'the code';
    ctx.requestResolver.resolve({ code });
    await flushPromises();
    return { ...ctx, code };
  })

  .step(/resolve should be called with the received code/, (ctx) => {
    expect(ctx.resolve).toBeCalledWith(ctx.code);
  })

  .step(/resolve should be called/, (ctx) => {
    expect(ctx.resolve).toBeCalled();
  })

  .step(/resolve should not be called/, (ctx) => {
    expect(ctx.resolve).not.toBeCalled();
  })

  .step(/reject should be called with an? "(.*)"/, (ctx, errorType) => {
    expect(ctx.reject).toBeCalledWith(expect.any(errors[errorType]));
  })

  .step(/reject should not be called/, (ctx) => {
    expect(ctx.reject).not.toBeCalled();
  })


  .steps([treeMounted, storageHasData])

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
  .then('signIn.resolve action should be dispatched with tokens and user data')
  .then('resolve should be called with tokens and user data')
  .then('reject should not be called')
  .then('store should be in signed-in state')


  .scenario('Signing in with invalid credentials')

  .when('signIn action is dispatched')
  .when('signIn request fails with "invalid credentials" error')
  .then('signIn.resolve action should be dispatched with "InvalidCredentials" error')
  .then('reject should be called with "InvalidCredentials" error')
  .then('resolve should not be called')
  .then('store should be in signed-out state with "InvalidCredentials" error')


  .scenario('Signing in, sign-in request fails')

  .when('signIn action is dispatched')
  .when('signIn request fails with unexpected error')
  .then('signIn.resolve action should be dispatched with "AuthError" error')
  .then('reject should be called with "AuthError" error')
  .then('resolve should not be called')
  .then('store should be in signed-out state with "AuthError" error')


  .scenario('Signing in, user request fails')

  .when('signIn action is dispatched')
  .when('signIn request succeeds')
  .when('fetchUser request fails with unexpected error')
  .then('signIn.resolve action should be dispatched with "AuthError" error')
  .then('reject should be called with "AuthError" error')
  .then('resolve should not be called')
  .then('store should be in signed-out state with "AuthError" error')


  .steps([treeMounted, storageHasData])

  .step(/signIn action is dispatched/, (ctx) => {
    const resolve = jest.fn();
    const reject = jest.fn();
    const credentials = { username: 'bob', password: 's3cr3t' };
    ctx.store.dispatch(actions.signIn(credentials, { resolve, reject }));
    return { ...ctx, credentials, resolve, reject };
  })

  .step(/signIn request is expected/, (ctx) => {
    const result = defer();
    fetchMock.postOnce(`${api}/login`, result.promise, { name: 'signIn' });
    return { ...ctx, signInRequestResolver: result.resolver };
  }, () => {
    fetchMock.restore();
  })

  .step(/fetchUser request is expected/, (ctx) => {
    const result = defer();
    fetchMock.getOnce(`${api}/api-root`, result.promise, { name: 'fetchUser' });
    return { ...ctx, fetchUserRequestResolver: result.resolver };
  })

  .step(/signIn request should be made/, (ctx) => {
    expect(fetchMock.called('signIn')).toBe(true);
    expect(fetchMock.lastOptions('signIn')).toEqual(expect.objectContaining({
      body: JSON.stringify(ctx.credentials),
    }));
  })

  .step(/fetchUser request should be made/, () => {
    expect(fetchMock.called('fetchUser')).toBe(true);
    expect(fetchMock.lastOptions('fetchUser')).toEqual(expect.objectContaining({
      headers: expect.objectContaining({
        Authorization: `Bearer ${tokens.token}`,
      }),
    }));
  })

  .step(/signIn request succeeds/, async (ctx) => {
    ctx.signInRequestResolver.resolve(tokensRaw);
    await flushPromises();
  })

  .step(/signIn request fails with (".*"|unexpected) error/, async (ctx, responseError) => {
    const [status, error] = invoke(responseError, {
      '"invalid credentials"': () => [200, 'Login attempt failed'],
      unexpected: () => [500, 'error'],
    });
    ctx.signInRequestResolver.resolve({ status, body: { error } });
    await flushPromises();
  })

  .step(/fetchUser request succeeds/, async (ctx) => {
    ctx.fetchUserRequestResolver.resolve(user);
    await flushPromises();
  })

  .step(/fetchUser request fails with (".*"|unexpected) error/, async (ctx, responseError) => {
    const [status, error] = invoke(responseError, {
      '"not authenticated"': () => [401, 'whatever'],
      unexpected: () => [500, 'error'],
    });
    ctx.fetchUserRequestResolver.resolve({ status, body: { error } });
    await flushPromises();
  })

  .step(/tokens should be stored/, (ctx) => {
    expect(ctx.storage.set).toBeCalledWith('tokens', tokens);
  })

  .step(/user data should be stored/, (ctx) => {
    expect(ctx.storage.set).toBeCalledWith('user', user);
  })

  .step(/signIn.resolve action should be dispatched with tokens and user data/, (ctx) => {
    expect(ctx.store.dispatchSpy).toBeCalledWith(actions.signIn.resolve({ tokens, user }));
  })

  .step(/signIn.resolve action should be dispatched with "(.*)" error/, async (ctx, error) => {
    expect(ctx.store.dispatchSpy).toBeCalledWith(expect.objectContaining({
      type: actions.signIn.resolve.type,
      payload: expect.any(errors[error]),
      error: true,
    }));
  })

  .step(/resolve should be called with tokens and user data/, (ctx) => {
    expect(ctx.resolve).toBeCalledWith({ tokens, user });
  })

  .step(/resolve should not be called/, (ctx) => {
    expect(ctx.resolve).not.toBeCalled();
  })

  .step(/reject should be called with "(.*)" error/, (ctx, error) => {
    expect(ctx.reject).toBeCalledWith(expect.any(errors[error]));
  })

  .step(/reject should not be called/, (ctx) => {
    expect(ctx.reject).not.toBeCalled();
  })

  .step(/store should be in signing-in state/, (ctx) => {
    expect(selector(ctx.store.getState())).toEqual({
      state: 'SIGNING_IN',
      waiting: true,
      error: undefined,
      username: undefined,
      authenticated: false,
      email: undefined,
      tokens: {},
      signInRedirect,
      signOutRedirect,
    });
  })

  .step(/store should be in signed-in state/, (ctx) => {
    expect(selector(ctx.store.getState())).toEqual({
      state: 'SIGNED_IN',
      waiting: false,
      error: undefined,
      username: user.current_user,
      authenticated: true,
      email: user.email,
      tokens,
      signInRedirect,
      signOutRedirect,
    });
  })

  .step(/store should be in signed-out state/, (ctx) => {
    expect(selector(ctx.store.getState())).toEqual({
      state: 'SIGNED_OUT',
      waiting: false,
      error: undefined,
      username: undefined,
      authenticated: false,
      email: undefined,
      tokens: {},
      signInRedirect,
      signOutRedirect,
    });
  })


  .run();
