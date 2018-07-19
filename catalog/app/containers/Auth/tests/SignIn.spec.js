import createHistory from 'history/createMemoryHistory';
import { fromJS } from 'immutable';
import React from 'react';

import LanguageProvider from 'containers/LanguageProvider';
import { translationMessages as messages } from 'i18n';
import FormProvider from 'utils/ReduxFormProvider';
import StoreProvider from 'utils/StoreProvider';
import configureStore from 'store';

import feature from 'testing/feature';
import errorSteps from 'testing/error';
import formSteps from 'testing/form';
import reactSteps from 'testing/react';
import requestsSteps from 'testing/requests';
import storageSteps from 'testing/storage';
import { mockComponentSelector } from 'testing/util';

import {
  Provider as AuthProvider,
  SignIn,
  errors,
} from '..';

import {
  api,
  tokensRaw,
  user,
  datasets,
} from './fixtures';

jest.mock('material-ui/RaisedButton');
jest.mock('material-ui/TextField');
jest.mock('react-router-dom');
jest.mock('components/Spinner');
jest.mock('constants/config');
jest.mock('utils/time');
jest.mock('utils/errorReporting');

const paths = {
  signIn: '/signin',
  page1: '/page1',
  page2: '/page2',
};
const signInRedirect = paths.page1;


const fields = ['password', 'username'];

const values = {
  'invalid password': 'invalid',
  'valid password': 'valid',
  username: 'bob',
};

const onSubmit = (ctx) => {
  const credentials = {
    username: ctx.mounted.find(`${mockComponentSelector('TextField')}[name="username"]`).prop('value'),
    password: ctx.mounted.find(`${mockComponentSelector('TextField')}[name="password"]`).prop('value'),
  };
  return { ...ctx, credentials };
};

const requests = {
  signIn: {
    setup: () => ['post', '/api/login'],
    expect: (ctx) =>
      expect.objectContaining({
        body: JSON.stringify(ctx.credentials),
      }),
    success: () => tokensRaw,
  },
  fetchUser: {
    setup: () => ['getOnce', '/api/me'],
    success: () => user,
  },
};

const setup = (ctx) => {
  const history = createHistory({ initialEntries: ['/'] });
  const store = configureStore(fromJS({}), history);
  const search = ctx.next ? `?next=${encodeURIComponent(ctx.next)}` : '';
  const tree = (
    <StoreProvider store={store}>
      <FormProvider>
        <LanguageProvider messages={messages}>
          <AuthProvider
            storage={ctx.storage}
            api={api}
            signInRedirect={signInRedirect}
          >
            <SignIn location={{ search }} />
          </AuthProvider>
        </LanguageProvider>
      </FormProvider>
    </StoreProvider>
  );
  return { tree };
};

const steps = [
  ...requestsSteps(api, requests),
  ...formSteps({ values, fields, onSubmit }),
  ...errorSteps(errors),
  ...reactSteps({ setup }),
  ...storageSteps(datasets),
];


feature('containers/Auth/SignIn')
  .scenario('Redirecting when user is authenticated')

  .given('storage has current auth data')
  .given('next param is set to page2')

  .when('the component tree is mounted')
  .then('I should be redirected to page2')


  .scenario('Signing in')

  .given('storage has empty auth data')
  .given('signIn request is expected')
  .given('fetchUser request is expected')

  .when('the component tree is mounted')
  .then('I should see the form in interactive state')
  .then('the rendered markup should match the snapshot')

  .when('I submit the form')
  .then('I should see error on username field: "Enter your username"')
  .then('I should see error on password field: "Enter your password"')
  .then('I should see the form in invalid state')
  .then('the rendered markup should match the snapshot')

  .when('I enter username into username field')
  .then('I should see no error on username field')

  .when('I enter invalid password into password field')
  .then('I should see no error on password field')
  .then('I should see the form in valid state')

  .when('I submit the form')
  .then('I should see the form in waiting state')
  .then('the rendered markup should match the snapshot')

  .when('signIn request fails with 401')
  .then('I should see the form in invalid state')
  .then('I should see form error: "Invalid credentials"')
  .then('the rendered markup should match the snapshot')

  .when('I enter valid password into password field')
  .then('I should see no form error')
  .then('I should see the form in valid state')

  .when('I submit the form')
  .when('signIn request fails with 500')
  .then('I should see form error: "Something went wrong"')
  .then('I should see the form in invalid state')
  .then('the rendered markup should match the snapshot')
  .then('an AuthError error should be captured')

  .when('I re-enter valid password into password field')
  .then('I should see no form error')
  .then('I should see the form in valid state')

  .when('I submit the form')
  .when('signIn request succeeds')
  .when('fetchUser request succeeds')
  .then('I should be redirected to page1')

  .step(/I should be redirected to (.+)/, (ctx, path) => {
    ctx.mounted.update();
    expect(ctx.mounted.find(mockComponentSelector('Redirect')).prop('to'))
      .toBe(paths[path]);
  })

  .step(/next param is set to (.+)/, (ctx, path) => ({
    ...ctx,
    next: paths[path],
  }))

  .steps(steps)
  .run();
