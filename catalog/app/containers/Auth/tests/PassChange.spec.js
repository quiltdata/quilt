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
import { mockComponentSelector } from 'testing/util';

import {
  Provider as AuthProvider,
  PassChange,
  errors,
} from '..';

import { api } from './fixtures';

jest.mock('material-ui/RaisedButton');
jest.mock('material-ui/TextField');
jest.mock('react-router-dom');

jest.mock('components/Spinner');
jest.mock('constants/config');
jest.mock('utils/errorReporting');
jest.mock('utils/time');

const requests = {
  changePassword: {
    setup: () => ['post', '/reset_password'],
    expect: ({ link, password }) =>
      expect.objectContaining({
        body: JSON.stringify({ link, password }),
      }),
  },
};

const values = {
  password: 'valid',
  'invalid password': 'invalid',
};

const fields = ['password', 'passwordCheck'];

const onSubmit = (ctx) => ({
  ...ctx,
  password:
    ctx.mounted
      .find(`${mockComponentSelector('TextField')}[name="password"]`)
      .prop('value'),
});

const screens = {
  success: (html) => {
    const msgs = html.find('p');
    expect(msgs.eq(0).text()).toMatch('Your password has been changed');
    expect(msgs.eq(1).text()).toMatch('Now you can sign in');
    expect(msgs.eq(1).find(mockComponentSelector('Link')).attr('to')).toBe('/signin');
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
  const link = 'test-link';
  const tree = (
    <StoreProvider store={store}>
      <FormProvider>
        <LanguageProvider messages={messages}>
          <AuthProvider
            storage={storage}
            api={api}
          >
            <PassChange match={{ params: { link } }} />
          </AuthProvider>
        </LanguageProvider>
      </FormProvider>
    </StoreProvider>
  );
  return { tree, link };
};

const steps = [
  ...requestsSteps(api, requests),
  ...formSteps({ values, fields, onSubmit }),
  ...errorSteps(errors),
  ...reactSteps({ setup, screens }),
];


feature('containers/Auth/PassChange')
  .scenario('Trying to change the password when the link is invalid')

  .given('changePassword request is expected')

  .when('the component tree is mounted')
  .then('I should see the form in interactive state')
  .then('the rendered markup should match the snapshot')

  .when('I submit the form')
  .then('I should see the form in invalid state')
  .then('the rendered markup should match the snapshot')
  .then('I should see error on password field: "Enter a password"')
  .then('I should see error on passwordCheck field: "Enter the password again"')

  .when('I enter password into password field')
  .then('I should see no error on password field')

  .when('I enter invalid password into passwordCheck field')
  .then('I should see error on passwordCheck field: "Passwords must match"')

  .when('I enter password into passwordCheck field')
  .then('I should see no error on passwordCheck field')
  .then('I should see the form in valid state')

  .when('I submit the form')
  .then('I should see the form in waiting state')
  .then('changePassword request should be made')

  .when('changePassword request fails with 401, error: "Reset token invalid."')
  .then('I should see the form in invalid state')
  .then('the rendered markup should match the snapshot')
  .then('I should see form error: "This reset link is invalid"')

  .back()
  .when('changePassword request fails with 404, error: "User not found."')
  .then('I should see the form in invalid state')
  .then('the rendered markup should match the snapshot')
  .then('I should see form error: "This reset link is invalid"')

  .back()
  .when('changePassword request fails with 500')
  .then('I should see the form in invalid state')
  .then('the rendered markup should match the snapshot')
  .then('I should see form error: "Something went wrong"')
  .then('an AuthError error should be captured')


  .scenario('Changing the password when the link is valid')

  .given('changePassword request is expected')

  .when('the component tree is mounted')
  .when('I enter invalid password into password field')
  .when('I enter invalid password into passwordCheck field')
  .when('I submit the form')
  .then('I should see the form in waiting state')
  .then('changePassword request should be made')

  .when('changePassword request fails with 400, message: "Password must be"')
  .then('I should see the form in invalid state')
  .then('the rendered markup should match the snapshot')
  .then('I should see error on password field: "Password must be"')

  .when('I enter password into password field')
  .then('I should see no error on password field')

  .when('I enter password into passwordCheck field')
  .then('I should see no error on passwordCheck field')
  .then('I should see the form in valid state')

  .when('I submit the form')
  .when('changePassword request succeeds')
  .then('I should see the success screen')
  .then('the rendered markup should match the snapshot')

  .steps(steps)
  .run();
