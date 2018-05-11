/* eslint-disable import/first */

/*
Auth module spec. Public interface to be tested:
- mounting a protected component
- mounting the SignOut component
- mounting the Callback component
- selecting the state
- showing notifications
- making auth headers
- dispatching authLost action
*/

import createHistory from 'history/createMemoryHistory';
import { fromJS } from 'immutable';
import React from 'react';
import { Switch, Route } from 'react-router-dom';
import { LOCATION_CHANGE } from 'react-router-redux';
import { createStructuredSelector } from 'reselect';
import { stringify } from 'querystring';

import LanguageProvider from 'containers/LanguageProvider';
import Notifications from 'containers/Notifications';
import { translationMessages as messages } from 'i18n';
import RouterProvider from 'utils/router';
import StoreProvider from 'utils/StoreProvider';
import configureStore from 'store';

import feature, { step } from 'testing/feature';
import RequestTracker from 'testing/RequestTracker';
import {
  findMockComponent,
  flushPromises,
  getLocation,
  mockComponent,
} from 'testing/util';
import reactSteps from 'testing/steps/react';

import { authLost } from '../actions';
import { ERROR_REDIRECT_PATH } from '../constants';
import AuthProvider from '../index';
import Callback from '../Callback';
import SignOut from '../SignOut';
import { makeHeaders } from '../saga';
import * as selectors from '../selectors';
import { adjustTokensForLatency, makeSignInURL } from '../util';
import requireAuth from '../wrapper';


// mock non-injectable boundaries
jest.mock('constants/urls', () => ({
  authorizePath: '/login',
  tokenPath: '/token',
  authHandlerPath: '/callback',
}));
import * as urls from 'constants/urls';

jest.mock('constants/config', () => ({
  api: 'https://api',
  userApi: 'https://auth',
  signOutUrl: '/',
}));
import * as config from 'constants/config';

jest.mock('utils/storage');
import * as storage from 'utils/storage';

jest.mock('utils/request');
import { requestJSON } from 'utils/request';

jest.mock('utils/time');
import { timestamp } from 'utils/time';

jest.mock('components/Error', () =>
  // eslint-disable-next-line global-require
  require('testing/util').mockComponent('Error', ['headline', 'detail']));

jest.mock('components/Redirect', () =>
  // eslint-disable-next-line global-require
  require('testing/util').mockComponent('Redirect', ['url']));

jest.mock('components/Working', () =>
  // eslint-disable-next-line global-require
  require('testing/util').mockComponent('Working', ['children']));


// injectable mocks, fixtures and stuff
const Notification = mockComponent('Notification', ['message', 'action']);
const Home = mockComponent('Home', () => ({}));
const Private = mockComponent('Private', () => ({}));
const ProtectedPrivate = requireAuth(Private);

const unit = 100000; // ~ a day
const date = new Date('2018-01-01T12:00:00Z').getTime() / 1000;

const tokensStaleRaw = {
  access_token: 'ACCESS1',
  expires_at: date - unit,
  refresh_token: 'REFRESH1',
};

const tokensRaw = {
  access_token: 'ACCESS2',
  expires_at: date + unit,
  refresh_token: 'REFRESH2',
};

const tokensStale = adjustTokensForLatency(tokensStaleRaw);
const tokens = adjustTokensForLatency(tokensRaw);

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

const paths = {
  home: '/',
  private: '/private',
  callback: urls.authHandlerPath,
  signout: '/signout',
};

const checkAuthOn = ({ type, payload }) =>
  type === LOCATION_CHANGE && !payload.pathname.startsWith(paths.callback);

const selector = createStructuredSelector(selectors);


// reusable steps
const storageSteps = [
  step(/storage has (current|stale|empty) auth data/, (ctx, dataSet) => {
    storage.load.mockReturnValue(dataSets[dataSet]);
  }),

  step(/adjusted tokens should be stored/, () => {
    expect(storage.set).toBeCalledWith('tokens', tokens);
  }),

  step(/tokens should be forgotten/, () => {
    expect(storage.remove).toBeCalledWith('tokens');
  }),

  step(/user data should be stored/, () => {
    expect(storage.set).toBeCalledWith('user', user);
  }),

  step(/user data should be forgotten/, () => {
    expect(storage.remove).toBeCalledWith('user');
  }),
];

const tokenRefreshUrl = `${config.api}${urls.tokenPath}`;

const requestSteps = [
  step(/token refresh request should be made/, (ctx) => {
    expect(ctx.request.hasRequest('POST', tokenRefreshUrl)).toBe(true);
  }),

  step(/token refresh request is resolved/, async (ctx) => {
    ctx.request.resolve('POST', tokenRefreshUrl, tokensRaw);
    await flushPromises();
  }),

  step(/token refresh request is rejected/, async (ctx) => {
    ctx.request.resolve('POST', tokenRefreshUrl, { error: 'test' });
    await flushPromises();
  }),

  step(/user request should be made/, (ctx) => {
    expect(ctx.request.findRequests('GET', config.userApi)[0].opts.headers)
      .toEqual(expect.objectContaining({
        Authorization: `Bearer ${tokens.access_token}`,
      }));
  }),

  step(/user request is resolved/, async (ctx) => {
    ctx.request.resolve('GET', config.userApi, user);
    await flushPromises();
  }),

  step(/user request is rejected/, async (ctx) => {
    ctx.request.reject('GET', config.userApi, new Error('test'));
    await flushPromises();
  }),

  step(/auth refresh requests should be made/, (ctx) => {
    ctx.step(ctx, 'token refresh request should be made');
  }),

  step(/auth refresh requests are resolved/, async (ctx) => {
    await ctx.step(ctx, 'token refresh request is resolved');
    ctx.step(ctx, 'user request should be made');
    await ctx.step(ctx, 'user request is resolved');
  }),

  step(/auth refresh requests are rejected/, async (ctx) => {
    await ctx.step(ctx, 'token refresh request is rejected');
  }),
];

const commonSteps = [
  ...reactSteps,
  ...storageSteps,
  ...requestSteps,
];


feature('containers/Auth/util: makeSignInURL()')
  .scenario('Calling without arguments')
  .when('makeSignInURL() is called without arguments')
  .then('result should be "https://api/login?next=https%3A%2F%2Fquilt-test%2Fcallback%3Fnext%3D%252Fprofile"')

  .scenario('Calling with 1 argument (path), passing the root path')
  .when('makeSignInURL() is called with argument "/"')
  .then('result should be "https://api/login?next=https%3A%2F%2Fquilt-test%2Fcallback%3Fnext%3D%252Fprofile"')

  .scenario('Calling with 1 argument (path), passing the non-root path')
  .when('makeSignInURL() is called with argument "/test"')
  .then('result should be "https://api/login?next=https%3A%2F%2Fquilt-test%2Fcallback%3Fnext%3D%252Ftest"')

  .scenario('Calling with 2 arguments (path and origin)')
  .when('makeSignInURL() is called with arguments "/test" and "https://test-origin"')
  .then('result should be "https://api/login?next=https%3A%2F%2Ftest-origin%2Fcallback%3Fnext%3D%252Ftest"')

  .step(/makeSignInURL\(\) is called without arguments/, (ctx) => ({
    ...ctx,
    result: makeSignInURL(),
  }))

  .step(/makeSignInURL\(\) is called with argument "(.*)"/, (ctx, arg) => ({
    ...ctx,
    result: makeSignInURL(arg),
  }))

  .step(/makeSignInURL\(\) is called with arguments "(.*)" and "(.*)"/, (ctx, arg1, arg2) => ({
    ...ctx,
    result: makeSignInURL(arg1, arg2),
  }))

  .step(/result should be "(.*)"/, ({ result }, expected) => {
    expect(result).toBe(expected);
  })

  .run();


feature('containers/Auth/saga: makeHeaders()')
  .given('minimal setup')


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
  .then('token refresh request should be made')

  .when('token refresh request is resolved')
  .then('result should be an object containing the proper auth header')


  .scenario('Requesting auth headers when auth data is stale and then gets refreshed with error')
  .given('storage has stale auth data')
  .given('the component tree is mounted')

  .when('the saga is run')
  .then('token refresh request should be made')

  .when('token refresh request is rejected')
  .then('result should be an empty object')


  .steps(commonSteps)

  .step(/minimal setup/, (ctx) => {
    const history = createHistory({ initialEntries: ['/'] });
    const store = configureStore(fromJS({}), history);
    const tree = (
      // we must wrap the tree into div, because enzyme doesn't support fragments
      // https://github.com/airbnb/enzyme/issues/1213
      <div>
        <StoreProvider store={store}>
          <LanguageProvider messages={messages}>
            <AuthProvider>
              <Home />
            </AuthProvider>
          </LanguageProvider>
        </StoreProvider>
      </div>
    );
    const request = RequestTracker(requestJSON);
    timestamp.mockReturnValue(date);
    return { ...ctx, history, store, tree, request };
  })

  .step(/the saga is run/, (ctx) => ({
    ...ctx,
    result: ctx.store.runSaga(makeHeaders).done,
  }))

  .step(/result should be an empty object/, async ({ result }) => {
    expect(await result).toEqual({});
  })

  .step(/result should be an object containing the proper auth header/, async ({ result }) => {
    expect(await result).toEqual({
      Authorization: `Bearer ${tokens.access_token}`,
    });
  })

  .run();


feature('containers/Auth/SignOut')
  .given('minimal setup')


  .scenario('Mounting the component when auth data is absent')
  .given('storage has empty auth data')

  .when('the component tree is mounted')
  .then('the user should be signed out')


  .scenario('Mounting the component when auth data is current')
  .given('storage has current auth data')

  .when('the component tree is mounted')
  .then('the user should be signed out')


  .scenario('Mounting the component when auth data is stale and then gets refreshed successfully')
  .given('storage has stale auth data')

  .when('the component tree is mounted')
  .then('the user should see the activity indicator')
  .then('auth refresh requests should be made')

  .when('auth refresh requests are resolved')
  .then('the user should be signed out')


  .scenario('Mounting the component when auth data is stale and then gets refreshed with error')
  .given('storage has stale auth data')

  .when('the component tree is mounted')
  .then('the user should see the activity indicator')
  .then('auth refresh requests should be made')

  .when('auth refresh requests are rejected')
  .then('the user should be signed out')


  .steps(commonSteps)

  .step(/minimal setup/, (ctx) => {
    const history = createHistory({ initialEntries: [paths.signout] });
    const store = configureStore(fromJS({}), history);
    const tree = (
      // we must wrap the tree into div, because enzyme doesn't support fragments
      // https://github.com/airbnb/enzyme/issues/1213
      <div>
        <StoreProvider store={store}>
          <LanguageProvider messages={messages}>
            <AuthProvider checkOn={checkAuthOn}>
              <RouterProvider history={history}>
                <Switch>
                  <Route path={paths.home} exact component={Home} />
                  <Route path={paths.signout} exact component={SignOut} />
                </Switch>
              </RouterProvider>
              <Notifications NotificationComponent={Notification} />
            </AuthProvider>
          </LanguageProvider>
        </StoreProvider>
      </div>
    );
    const request = RequestTracker(requestJSON);
    timestamp.mockReturnValue(date);
    return { ...ctx, history, store, tree, request };
  })

  .step(/the user should be signed out/, (ctx) => {
    expect(getLocation(ctx.history)).toBe(config.signOutUrl);

    const html = ctx.mounted.render();
    expect(findMockComponent(html, 'Home')).toHaveLength(1);
    expect(html).toMatchSnapshot();

    const selected = selector(ctx.store.getState());
    expect(selected).toEqual(expect.objectContaining({
      authenticated: false,
      waiting: false,
    }));
    expect(selected).toMatchSnapshot();
  })

  .step(/the user should see the activity indicator/, (ctx) => {
    expect(getLocation(ctx.history)).toBe(paths.signout);

    const html = ctx.mounted.render();
    expect(findMockComponent(html, 'Working')).toHaveLength(1);
    expect(html).toMatchSnapshot();

    const selected = selector(ctx.store.getState());
    expect(selected).toEqual(expect.objectContaining({
      authenticated: true,
      waiting: true,
    }));
    expect(selected).toMatchSnapshot();
  })

  .run();


const query = stringify({ next: paths.private });
const hash = stringify(tokens);
const callbackPath = `${paths.callback}?${query}#${hash}`;

feature('containers/Auth/Callback')
  .given('minimal setup')
  .given('storage has empty auth data')


  .scenario('Mounting the component when the tokens are valid')

  .when('the component tree is mounted')
  .then('the user should see the activity indicator')
  .then('adjusted tokens should be stored')
  .then('user request should be made')

  .when('user request is resolved')
  .then('user data should be stored')
  .then('the user should be signed in')

  .scenario('Mounting the component when the tokens are invalid')

  .when('the component tree is mounted')
  .then('the user should see the activity indicator')
  .then('adjusted tokens should be stored')
  .then('user request should be made')

  .when('user request is rejected')
  .then('tokens should be forgotten')
  .then('the user should not be signed in')


  .steps(commonSteps)

  .step(/minimal setup/, (ctx) => {
    const history = createHistory({ initialEntries: [callbackPath] });
    const store = configureStore(fromJS({}), history);
    const tree = (
      // we must wrap the tree into div, because enzyme doesn't support fragments
      // https://github.com/airbnb/enzyme/issues/1213
      <div>
        <StoreProvider store={store}>
          <LanguageProvider messages={messages}>
            <AuthProvider>
              <RouterProvider history={history}>
                <Switch>
                  <Route path={paths.home} exact component={Home} />
                  <Route path={paths.private} exact component={ProtectedPrivate} />
                  <Route path={paths.callback} exact component={Callback} />
                </Switch>
              </RouterProvider>
              <Notifications NotificationComponent={Notification} />
            </AuthProvider>
          </LanguageProvider>
        </StoreProvider>
      </div>
    );
    const request = RequestTracker(requestJSON);
    timestamp.mockReturnValue(date);
    return { ...ctx, history, store, tree, request };
  })

  .step(/the user should see the activity indicator/, (ctx) => {
    expect(getLocation(ctx.history)).toBe(callbackPath);

    const html = ctx.mounted.render();
    expect(findMockComponent(html, 'Working')).toHaveLength(1);
    expect(html).toMatchSnapshot();

    const selected = selector(ctx.store.getState());
    expect(selected).toEqual(expect.objectContaining({
      authenticated: false,
      waiting: true,
    }));
    expect(selected).toMatchSnapshot();
  })

  .step(/the user should be signed in/, (ctx) => {
    expect(getLocation(ctx.history)).toBe(paths.private);

    const html = ctx.mounted.render();
    expect(findMockComponent(html, 'Private')).toHaveLength(1);
    expect(html).toMatchSnapshot();

    const selected = selector(ctx.store.getState());
    expect(selected).toEqual(expect.objectContaining({
      authenticated: true,
      waiting: false,
    }));
    expect(selected).toMatchSnapshot();
  })

  .step(/the user should not be signed in/, (ctx) => {
    expect(getLocation(ctx.history)).toBe(ERROR_REDIRECT_PATH);

    const html = ctx.mounted.render();
    expect(findMockComponent(html, 'Home')).toHaveLength(1);
    expect(findMockComponent(html, 'Notification').attr('message'))
      .toEqual(expect.stringMatching(/error signing in/i));
    expect(html).toMatchSnapshot();

    const selected = selector(ctx.store.getState());
    expect(selected).toEqual(expect.objectContaining({
      authenticated: false,
      waiting: false,
      error: expect.any(Error),
    }));
    expect(selected).toMatchSnapshot();
  })

  .run();


const signInUrl = 'https://api/login?next=https%3A%2F%2Fquilt-test%2Fcallback%3Fnext%3D%252Fprivate';

feature('containers/Auth/wrapper')
  .given('minimal setup')


  .scenario('Mounting the wrapped component when auth data is absent')
  .given('storage has empty auth data')

  .when('the component tree is mounted')
  .then('the user should be redirected to the sign-in url')


  .scenario('Mounting the wrapped component when auth data is current')
  .given('storage has current auth data')

  .when('the component tree is mounted')
  .then('the wrapped component should be rendered')

  .when('authentication is lost')
  .then('error screen should be displayed')


  .scenario('Mounting the wrapped component when auth data is stale and then gets refreshed successfully')
  .given('storage has stale auth data')

  .when('the component tree is mounted')
  .then('the wrapped component should be rendered')
  .then('auth refresh requests should be made')

  .when('auth refresh requests are resolved')
  .then('the wrapped component should be rendered')


  .scenario('Mounting the wrapped component when auth data is stale and then gets refreshed with error')
  .given('storage has stale auth data')

  .when('the component tree is mounted')
  .then('wrapped component should be rendered')
  .then('auth refresh requests should be made')

  .when('auth refresh requests are rejected')
  .then('error screen should be displayed')


  .steps(commonSteps)

  .step(/minimal setup/, (ctx) => {
    const history = createHistory({ initialEntries: [paths.private] });
    const store = configureStore(fromJS({}), history);
    const tree = (
      // we must wrap the tree into div, because enzyme doesn't support fragments
      // https://github.com/airbnb/enzyme/issues/1213
      <div>
        <StoreProvider store={store}>
          <LanguageProvider messages={messages}>
            <AuthProvider checkOn={checkAuthOn}>
              <RouterProvider history={history}>
                <Switch>
                  <Route path={paths.home} exact component={Home} />
                  <Route path={paths.private} exact component={ProtectedPrivate} />
                  <Route path={paths.callback} exact component={Callback} />
                </Switch>
              </RouterProvider>
              <Notifications NotificationComponent={Notification} />
            </AuthProvider>
          </LanguageProvider>
        </StoreProvider>
      </div>
    );
    const request = RequestTracker(requestJSON);
    timestamp.mockReturnValue(date);
    return { ...ctx, history, store, tree, request };
  })

  .step(/authentication is lost/, (ctx) => {
    ctx.store.dispatch(authLost(new Error('test')));
  })

  .step(/the user should be redirected to the sign-in url/, (ctx) => {
    const html = ctx.mounted.render();
    expect(findMockComponent(html, 'Redirect').attr('url')).toBe(signInUrl);
  })

  .step(/wrapped component should be rendered/, (ctx) => {
    expect(getLocation(ctx.history)).toBe(paths.private);

    const html = ctx.mounted.render();
    expect(findMockComponent(html, 'Private')).toHaveLength(1);
    expect(html).toMatchSnapshot();
  })

  .step(/error screen should be displayed/, (ctx) => {
    expect(getLocation(ctx.history)).toBe(paths.private);

    const html = ctx.mounted.render();
    expect(findMockComponent(html, 'Error')).toHaveLength(1);
    expect(findMockComponent(html, 'Notification').attr('message'))
      .toEqual(expect.stringMatching(/lost/));
    expect(html).toMatchSnapshot();
  })

  .run();
