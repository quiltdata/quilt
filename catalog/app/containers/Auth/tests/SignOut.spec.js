import createHistory from 'history/createMemoryHistory';
import { fromJS } from 'immutable';

import LanguageProvider from 'containers/LanguageProvider';
import { translationMessages as messages } from 'i18n';
import { Provider as APIProvider } from 'utils/APIConnector';
import { nest } from 'utils/reactTools';
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
  SignOut,
  errors,
} from '..';

import { api, date, datasets } from './fixtures';

jest.mock('react-router-dom');
jest.mock('components/Working');
jest.mock('constants/config');
jest.mock('utils/errorReporting');
jest.mock('utils/time');

const signOutRedirect = '/after-signout';

const requests = {
  signOut: {
    setup: () => ['postOnce', '/logout'],
  },
};

const screens = {
  progress: (html) => {
    expect(html.find(`${mockComponentSelector('Working')} span`).text())
      .toMatch('Signing out');
  },
};

const setup = ({ storage, fetch }) => {
  const history = createHistory({ initialEntries: ['/'] });
  const store = configureStore(fromJS({}), history);
  const tree = nest(
    [StoreProvider, { store }],
    [LanguageProvider, { messages }],
    [APIProvider, { base: api, fetch }],
    [AuthProvider, { storage, signOutRedirect }],
    SignOut,
  );
  timestamp.mockReturnValue(date);
  return { tree };
};

const steps = [
  ...requestsSteps(api, requests),
  ...errorSteps(errors),
  ...reactSteps({ setup, screens }),
  ...storageSteps(datasets),
];


feature('containers/Auth/SignOut')
  .scenario('Signing out')

  .given('storage has current auth data')
  .given('signOut request is expected')

  .when('the component tree is mounted')
  .then('I should see the progress screen')
  .then('the rendered markup should match the snapshot')
  .then('signOut request should be made')

  .when('signOut request succeeds')
  .then('I should be redirected to the post-signout url')

  .back()
  .when('signOut request fails with 500')
  .then('I should be redirected to the post-signout url')
  .then('an AuthError error should be captured')


  .scenario('Redirecting when user is authenticated')

  .given('storage has empty auth data')
  .given('signOut request is expected')

  .when('the component tree is mounted')
  .then('signOut request should not be made')
  .then('I should be redirected to the post-signout url')

  .step(/I should be redirected to the post-signout url/, (ctx) => {
    ctx.mounted.update();
    expect(ctx.mounted.find(mockComponentSelector('Redirect')).prop('to'))
      .toBe(signOutRedirect);
  })

  .steps(steps)
  .run();
