import createHistory from 'history/createMemoryHistory';
import { fromJS } from 'immutable';
import React from 'react';
import { LOCATION_CHANGE } from 'react-router-redux';

import LanguageProvider from 'containers/LanguageProvider';
import { translationMessages as messages } from 'i18n';
import RouterProvider from 'utils/router';
import StoreProvider from 'utils/StoreProvider';
import { timestamp } from 'utils/time';
import configureStore from 'store';

import feature from 'testing/feature';
import { mockComponentSelector } from 'testing/util';

import {
  Provider as AuthProvider,
  requireAuth,
  errors,
} from '..';

import { api, date, tokensRaw } from './support/fixtures';
import errorSteps from './support/error';
import reactSteps from './support/react';
import requestsSteps from './support/requests';
import storageSteps from './support/storage';

jest.mock('material-ui/RaisedButton');
jest.mock('react-router-dom');
jest.mock('components/Error');
jest.mock('components/Working');
jest.mock('constants/config', () => ({}));
jest.mock('utils/time');
jest.mock('utils/errorReporting');

const Home = () => <h1>home</h1>;
const ProtectedHome = requireAuth(Home);

const homePath = '/home?q=sup';

const requests = {
  refreshTokens: {
    setup: () => ['post', '/api/refresh'],
    success: () => tokensRaw,
  },
};

const screens = {
  placeholder: (html) => {
    expect(html.find(`${mockComponentSelector('Working')} span`).text())
      .toMatch('Authenticating');
  },
  home: (html, ctx) => {
    expect(html.text()).toMatch('home');
    expect(ctx.mounted.find('Home').props()).toEqual(ctx.props);
  },
  error: (html) => {
    expect(html.find(mockComponentSelector('Error', 'headline')).text())
      .toMatch('Authentication error');
    const detail = html.find(mockComponentSelector('Error', 'detail'));
    expect(detail.text()).toMatch('Something went wrong');
    expect(detail.find(mockComponentSelector('RaisedButton', 'label')).text())
      .toMatch('Retry');
  },
};

const setup = (ctx) => {
  const history = createHistory({ initialEntries: [homePath] });
  const store = configureStore(fromJS({}), history);
  const props = {
    prop1: 'test',
  };

  const tree = (
    <StoreProvider store={store}>
      <LanguageProvider messages={messages}>
        <AuthProvider
          storage={ctx.storage}
          api={api}
          checkOn={LOCATION_CHANGE}
        >
          <RouterProvider history={history}>
            <ProtectedHome {...props} />
          </RouterProvider>
        </AuthProvider>
      </LanguageProvider>
    </StoreProvider>
  );
  timestamp.mockReturnValue(date);
  return { tree, props };
};

const steps = [
  ...requestsSteps(requests),
  ...errorSteps(errors.AuthError),
  ...reactSteps({ setup, screens }),
  ...storageSteps,
];


feature('containers/Auth/wrapper')
  .scenario('Rendering the wrapped component when the user is authenticated')

  .given('storage has current auth data')

  .when('the component tree is mounted')
  .then('I should see the home screen')
  .then('the rendered markup should match the snapshot')


  .scenario('Redirecting to sign-in when the user is not authenticated')

  .given('storage has empty auth data')

  .when('the component tree is mounted')
  .then('I should be redirected to the sign-in page')


  .scenario('Waiting for authentication, showing error and retrying')

  .given('storage has stale auth data')
  .given('refreshTokens request is expected')

  .when('the component tree is mounted')
  .then('I should see the placeholder screen')
  .then('the rendered markup should match the snapshot')
  .then('refreshTokens request should be made')

  .when('refreshTokens request fails with 500')
  .then('I should see the error screen')
  .then('the rendered markup should match the snapshot')

  .when('I click the retry button')
  .then('I should see the placeholder screen')

  .when('refreshTokens request fails with 401')
  .then('I should be redirected to the sign-in page')


  .step(/I should be redirected to the sign-in page/, (ctx) => {
    ctx.mounted.update();
    expect(ctx.mounted.find(mockComponentSelector('Redirect')).prop('to'))
      .toBe(`/signin?next=${encodeURIComponent(homePath)}`);
  })

  .step(/I click the retry button/, (ctx) => {
    ctx.mounted.update();
    ctx.mounted.find(mockComponentSelector('RaisedButton')).simulate('click');
  })

  .steps(steps)
  .run();
