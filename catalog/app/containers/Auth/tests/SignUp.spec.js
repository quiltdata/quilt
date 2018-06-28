import createHistory from 'history/createMemoryHistory';
import { fromJS } from 'immutable';
import React from 'react';

import LanguageProvider from 'containers/LanguageProvider';
import { translationMessages as messages } from 'i18n';
import FormProvider from 'utils/ReduxFormProvider';
import StoreProvider from 'utils/StoreProvider';
import configureStore from 'store';

import feature from 'testing/feature';
import { mockComponentSelector } from 'testing/util';

import {
  Provider as AuthProvider,
  SignUp,
  errors,
} from '..';

import { api } from './support/fixtures';
import errorSteps from './support/error';
import formSteps from './support/form';
import reactSteps from './support/react';
import requestsSteps from './support/requests';

jest.mock('material-ui/RaisedButton');
jest.mock('material-ui/TextField');
jest.mock('react-router-dom');
jest.mock('components/Spinner');
jest.mock('constants/config');
jest.mock('utils/time');
jest.mock('utils/errorReporting');


const fields = ['username', 'email', 'password', 'passwordCheck'];

const values = {
  'invalid password': '1',
  'valid password': 'valid',
  'invalid username': '1',
  'username that is taken': 'bob',
  'valid username': 'bob1',
  'invalid email': '1',
  'email that is taken': 'bob@example.com',
  'valid email': 'bob1@example.com',
};

const onSubmit = (ctx) => {
  const credentials = {
    username: ctx.mounted.find(`${mockComponentSelector('TextField')}[name="username"]`).prop('value'),
    email: ctx.mounted.find(`${mockComponentSelector('TextField')}[name="email"]`).prop('value'),
    password: ctx.mounted.find(`${mockComponentSelector('TextField')}[name="password"]`).prop('value'),
  };
  return { ...ctx, credentials };
};

const requests = {
  signUp: {
    setup: () => ['post', '/register'],
    expect: (ctx) =>
      expect.objectContaining({
        body: JSON.stringify(ctx.credentials),
      }),
  },
};

const screens = {
  success: (html) => {
    expect(html.find('p').text()).toMatch('You have signed up');
  },
};

const setup = () => {
  const history = createHistory({ initialEntries: ['/'] });
  const store = configureStore(fromJS({}), history);
  const storage = {
    load: () => ({}),
    set: () => {},
    remove: () => {},
  };
  const tree = (
    <StoreProvider store={store}>
      <FormProvider>
        <LanguageProvider messages={messages}>
          <AuthProvider
            storage={storage}
            api={api}
          >
            <SignUp />
          </AuthProvider>
        </LanguageProvider>
      </FormProvider>
    </StoreProvider>
  );
  return { tree };
};

const steps = [
  ...requestsSteps(requests),
  ...formSteps({ values, fields, onSubmit }),
  ...errorSteps(errors.AuthError),
  ...reactSteps({ setup, screens }),
];


feature('containers/Auth/SignUp')
  .scenario('Signing up')

  .given('signUp request is expected')

  .when('the component tree is mounted')
  .then('I should see the form in interactive state')
  .then('the rendered markup should match the snapshot')

  .when('I submit the form')
  .then('I should see error on username field: "Enter a username"')
  .then('I should see error on email field: "Enter your email"')
  .then('I should see error on password field: "Enter a password"')
  .then('I should see error on passwordCheck field: "Enter the password again"')
  .then('I should see the form in invalid state')
  .then('the rendered markup should match the snapshot')

  .when('I enter invalid username into username field')
  .then('I should see no error on username field')

  .when('I enter invalid email into email field')
  .then('I should see no error on email field')

  .when('I enter invalid password into password field')
  .then('I should see no error on password field')

  .when('I enter valid password into passwordCheck field')
  .then('I should see error on passwordCheck field: "Passwords must match"')

  .when('I enter invalid password into passwordCheck field')
  .then('I should see the form in valid state')

  .when('I submit the form')
  .then('I should see the form in waiting state')
  .then('the rendered markup should match the snapshot')
  .then('signUp request should be made')

  .when('signUp request fails with 400, error: "Unacceptable username."')
  .then('I should see the form in invalid state')
  .then('I should see error on username field: "Username invalid"')
  .then('the rendered markup should match the snapshot')

  .when('I enter username that is taken into username field')
  .then('I should see the form in valid state')

  .when('I submit the form')
  .when('signUp request fails with 409, error: "Username already taken."')
  .then('I should see the form in invalid state')
  .then('I should see error on username field: "Username taken"')
  .then('the rendered markup should match the snapshot')

  .when('I enter valid username into username field')
  .then('I should see the form in valid state')

  .when('I submit the form')
  .when('signUp request fails with 400, error: "Unacceptable email."')
  .then('I should see the form in invalid state')
  .then('I should see error on email field: "Enter a valid email"')
  .then('the rendered markup should match the snapshot')

  .when('I enter email that is taken into email field')
  .then('I should see the form in valid state')

  .when('I submit the form')
  .when('signUp request fails with 409, error: "Email already taken."')
  .then('I should see the form in invalid state')
  .then('I should see error on email field: "Email taken"')
  .then('the rendered markup should match the snapshot')

  .when('I enter valid email into email field')
  .then('I should see the form in valid state')

  .when('I submit the form')
  .when('signUp request fails with 400, error: "Password must be"')
  .then('I should see the form in invalid state')
  .then('I should see error on password field: "Password must be"')
  .then('the rendered markup should match the snapshot')

  .when('I enter valid password into password field')
  .when('I enter valid password into passwordCheck field')
  .then('I should see the form in valid state')

  .when('I submit the form')
  .when('signUp request fails with 500')
  .then('I should see the form in invalid state')
  .then('I should see form error: "Something went wrong"')
  .then('the rendered markup should match the snapshot')
  .then('the error should be captured')

  .back()
  .when('signUp request succeeds')
  .then('I should see the success screen')
  .then('the rendered markup should match the snapshot')


  .steps(steps)
  .run();
