/* eslint-disable import/first */

import { mount } from 'enzyme';
import fetchMock from 'fetch-mock';
import createHistory from 'history/createMemoryHistory';
import { fromJS } from 'immutable';
import invoke from 'lodash/fp/invoke';
import React from 'react';
// import { Switch, Route } from 'react-router-dom';
// import { LOCATION_CHANGE } from 'react-router-redux';
// import { createStructuredSelector } from 'reselect';

import LanguageProvider from 'containers/LanguageProvider';
// import Notifications from 'containers/Notifications';
import { translationMessages as messages } from 'i18n';
import defer from 'utils/defer';
import StoreProvider from 'utils/StoreProvider';
import configureStore from 'store';

// import feature, { step } from 'testing/feature';
import feature from 'testing/feature';
import {
  // findMockComponent,
  flushPromises,
  // getLocation,
  mockComponent,
} from 'testing/util';

import {
  Provider as AuthProvider,
  actions,
  errors,
  // selectors,
  // makeHeaders,
} from '.';
// import { adjustTokensForLatency } from './saga';

jest.mock('constants/config', () => ({}));

jest.mock('utils/time');
import { timestamp } from 'utils/time';


const Home = mockComponent('Home', () => ({}));

const api = 'https://api';

const date = new Date('2018-01-01T12:00:00Z').getTime() / 1000;

feature('containers/Auth/Provider')
  // .scenario('init with different input and check state')

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

  .step(/the component tree is mounted/, (ctx) => {
    const history = createHistory({ initialEntries: ['/'] });
    const store = configureStore(fromJS({}), history);
    const storage = {
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
            >
              <Home />
            </AuthProvider>
          </LanguageProvider>
        </StoreProvider>
      </div>
    );
    timestamp.mockReturnValue(date);
    const mounted = mount(tree);
    return { ...ctx, history, store, tree, mounted };
  })

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

  .run();
