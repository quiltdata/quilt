import createHistory from 'history/createMemoryHistory';
import { fromJS } from 'immutable';
import React from 'react';
import { LOCATION_CHANGE } from 'react-router-redux';

import LanguageProvider from 'containers/LanguageProvider';
import { translationMessages as messages } from 'i18n';
import { Provider as APIProvider } from 'utils/APIConnector';
import { nest } from 'utils/reactTools';
import RouterProvider from 'utils/router';
import StoreProvider from 'utils/StoreProvider';
import { timestamp } from 'utils/time';
import configureStore from 'store';

import feature from 'testing/feature';
import errorSteps from 'testing/error';
import reactSteps from 'testing/react';
import requestsSteps from 'testing/requests';
import storageSteps from 'testing/storage';
import { mockComponentSelector } from 'testing/util';

import {
  Provider as AuthProvider,
  requireAuth,
  errors,
  apiMiddleware,
} from '..';

import { api, date, tokensRaw, datasets } from './fixtures';

jest.mock('material-ui/RaisedButton');
jest.mock('react-router-dom');
jest.mock('components/Error');
jest.mock('components/Working');
jest.mock('constants/config');
jest.mock('utils/time');
jest.mock('utils/errorReporting');

const Home = () => <h1>home</h1>;
const ProtectedHome = requireAuth(Home);

const homePath = '/home?q=sup';

const requests = {
  refreshTokens: {
    setup: () => ['post', '/refresh'],
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

const setup = ({ storage, fetch = () => {} }) => {
  const history = createHistory({ initialEntries: [homePath] });
  const store = configureStore(fromJS({}), history);
  const props = {
    prop1: 'test',
  };

  const tree = nest(
    [StoreProvider, { store }],
    [LanguageProvider, { messages }],
    [APIProvider, { base: api, fetch, middleware: [apiMiddleware] }],
    [AuthProvider, { storage, checkOn: LOCATION_CHANGE }],
    [RouterProvider, { history }],
    [ProtectedHome, props],
  );
  timestamp.mockReturnValue(date);
  return { tree, props };
};

const steps = [
  ...requestsSteps(api, requests),
  ...errorSteps(errors),
  ...reactSteps({ setup, screens }),
  ...storageSteps(datasets),
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
