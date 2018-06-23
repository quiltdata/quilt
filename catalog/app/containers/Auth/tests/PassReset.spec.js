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
  PassReset,
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
jest.mock('utils/errorReporting');
jest.mock('utils/time');

const requests = {
  resetPassword: {
    setup: () => ['post', '/reset_password'],
    expect: ({ email }) =>
      expect.objectContaining({
        body: JSON.stringify({ email }),
      }),
  },
};

const values = {
  email: 'bob@example.com',
};

const fields = ['email'];

const onSubmit = (ctx) => ({
  ...ctx,
  email:
    ctx.mounted
      .find(`${mockComponentSelector('TextField')}[name="email"]`)
      .prop('value'),
});

const screens = {
  success: (html) => {
    const msg = html.find('p');
    expect(msg.text()).toMatch('You have requested');
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
            <PassReset />
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


feature('containers/Auth/PassReset')
  .scenario('Resetting the password')

  .given('resetPassword request is expected')

  .when('the component tree is mounted')
  .then('I should see the form in interactive state')

  .when('I submit the form')
  .then('I should see error on email field: "Enter your email"')
  .then('I should see the form in invalid state')
  .then('the rendered markup should match the snapshot')

  .when('I enter email into email field')
  .then('I should see no error on email field')

  .when('I submit the form')
  .then('I should see the form in waiting state')
  .then('the rendered markup should match the snapshot')
  .then('resetPassword request should be made')

  .when('resetPassword request fails with 500')
  .then('I should see the form in invalid state')
  .then('the rendered markup should match the snapshot')
  .then('I should see form error: "Something went wrong"')
  .then('the error should be captured')

  .back()
  .when('resetPassword request succeeds')
  .then('I should see the success screen')
  .then('the rendered markup should match the snapshot')

  .steps(steps)
  .run();
