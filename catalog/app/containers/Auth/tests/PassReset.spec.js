/* eslint-disable import/first, global-require */

import { mount } from 'enzyme';
import createHistory from 'history/createMemoryHistory';
import { fromJS } from 'immutable';
import React from 'react';

import LanguageProvider from 'containers/LanguageProvider';
import { translationMessages as messages } from 'i18n';
import FormProvider from 'utils/ReduxFormProvider';
import StoreProvider from 'utils/StoreProvider';
import configureStore from 'store';

import feature from 'testing/feature';
import {
  mockComponentSelector,
  getPropName,
} from 'testing/util';

import {
  Provider as AuthProvider,
  PassReset,
  errors,
} from '..';

import {
  api,
  date,
} from './support/fixtures';
import requestsSteps from './support/requests';

jest.mock('constants/config', () => ({}));

jest.mock('utils/time');
import { timestamp } from 'utils/time';

jest.mock('utils/errorReporting');
import { captureError } from 'utils/errorReporting';

jest.mock('material-ui/RaisedButton', () =>
  require('testing/util').mockComponent('RaisedButton', {
    children: ['label', 'children'],
  }));
jest.mock('material-ui/TextField', () =>
  require('testing/util').mockComponentClass('TextField', {
    children: ['floatingLabelText', 'errorText'],
    methods: {
      getInputNode() { return null; },
    },
  }));

jest.mock('react-router-dom', () => ({
  Link: require('testing/util').mockComponent('Link', { el: 'a' }),
}));

jest.mock('components/Spinner', () =>
  require('testing/util').mockComponent('Spinner'));

const values = {
  email: 'bob@example.com',
};

const requests = {
  resetPassword: {
    setup: () => ['post', '/reset_password'],
    expect: ({ email }) =>
      expect.objectContaining({
        body: JSON.stringify({ email }),
      }),
  },
};

feature('containers/Auth/PassReset')
  .scenario('Resetting the password')

  .given('resetPassword request is expected')

  .when('the component tree is mounted')
  .then('I should see the form in interactive state')

  .when('I submit the form')
  .then('I should see error on email field: "Enter your email"')
  .then('I should see the form in error state')

  .when('I enter email into email field')
  .then('I should see no error on email field')

  .when('I submit the form')
  .then('I should see the form in waiting state')
  .then('resetPassword request should be made')

  .when('resetPassword request fails with 500')
  .then('I should see the form in error state')
  .then('I should see form error: "Something went wrong"')
  .then('I should see submit button disabled')
  .then('the error should be captured')

  .back()
  .when('resetPassword request succeeds')
  .then('I should see the success message')

  .steps([...requestsSteps(requests)])

  .step(/I (re-)?enter (.+) into (.+) field/, (ctx, re, valueName, fieldName) => {
    const field = ctx.mounted.find(`${mockComponentSelector('TextField')}[name="${fieldName}"]`);
    const value = values[valueName];
    field.simulate('focus');
    if (re) field.simulate('change', { target: { value: '' } });
    field.simulate('change', { target: { value } });
    field.simulate('blur');
  })

  .step(/I submit the form/, (ctx) => {
    const email = ctx.mounted.find(`${mockComponentSelector('TextField')}[name="email"]`).prop('value');
    ctx.mounted.find('form').simulate('submit');
    return { ...ctx, email };
  })

  .step(/I should see no error on (.+) field/, (ctx, fieldName) => {
    const field = ctx.mounted
      .find(`${mockComponentSelector('TextField')}[name="${fieldName}"]`);
    expect(field.find(getPropName('errorText'))).toHaveLength(0);
  })

  .step(/I should see error on (.+) field: "(.+)"/, (ctx, fieldName, errorText) => {
    ctx.mounted.update();
    const field = ctx.mounted
      .find(`${mockComponentSelector('TextField')}[name="${fieldName}"]`);
    expect(field.find(getPropName('errorText')).text()).toMatch(errorText);
  })

  .step(/I should see form error: "(.+)"/, (ctx, errorText) => {
    const html = ctx.mounted.render();
    expect(html.find(`${mockComponentSelector('TextField')} + p`).text())
      .toMatch(errorText);
  })

  .step(/I should see the form in interactive state/, (ctx) => {
    const html = ctx.mounted.render();
    expect(html).toMatchSnapshot();

    const email = ctx.mounted.find(mockComponentSelector('TextField')).at(0);

    expect(email.prop('name')).toBe('email');
    expect(email.prop('disabled')).toBe(false);

    expect(ctx.mounted.find(mockComponentSelector('RaisedButton', 'label')).text())
      .toBe('Reset');
    expect(ctx.mounted.find(mockComponentSelector('RaisedButton')).prop('disabled'))
      .toBe(false);
  })

  .step(/I should see the form in error state/, (ctx) => {
    const html = ctx.mounted.render();
    expect(html).toMatchSnapshot();

    expect(ctx.mounted.find(mockComponentSelector('RaisedButton')).prop('disabled'))
      .toBe(true);
  })

  .step(/I should see the form in waiting state/, (ctx) => {
    const html = ctx.mounted.render();
    expect(html).toMatchSnapshot();

    const email = ctx.mounted.find(mockComponentSelector('TextField')).at(0);

    expect(email.prop('disabled')).toBe(true);

    const btn = ctx.mounted.find(mockComponentSelector('RaisedButton'));
    expect(btn.prop('disabled')).toBe(true);
    expect(btn.find(`${getPropName('children')} ${mockComponentSelector('Spinner')}`))
      .toHaveLength(1);
  })

  .step(/I should see submit button enabled/, (ctx) => {
    expect(ctx.mounted.find(mockComponentSelector('RaisedButton')).prop('disabled'))
      .toBe(false);
  })

  .step(/I should see submit button disabled/, (ctx) => {
    expect(ctx.mounted.find(mockComponentSelector('RaisedButton')).prop('disabled'))
      .toBe(true);
  })

  .step(/I should see the success message/, (ctx) => {
    const html = ctx.mounted.render();
    const msg = html.find('p');
    expect(msg.text()).toMatch('You have requested');
    expect(html).toMatchSnapshot();
  })

  .step(/the error should be captured/, () => {
    expect(captureError).toBeCalledWith(expect.any(errors.AuthError));
  })

  .step(/the component tree is mounted/, (ctx) => {
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
              <PassReset />
            </AuthProvider>
          </LanguageProvider>
        </FormProvider>
      </StoreProvider>
    );
    timestamp.mockReturnValue(date);
    const mounted = mount(tree);
    return { ...ctx, mounted, link };
  })

  .run();
