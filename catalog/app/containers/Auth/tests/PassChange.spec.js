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
  PassChange,
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
  password: 'valid',
  'invalid password': 'invalid',
};

const requests = {
  changePassword: {
    setup: () => ['post', '/reset_password'],
    expect: ({ link, password }) =>
      expect.objectContaining({
        body: JSON.stringify({ link, password }),
      }),
  },
};

feature('containers/Auth/PassChange')
  .scenario('Trying to change the password when the link is invalid')

  .given('changePassword request is expected')

  .when('the component tree is mounted')
  .then('I should see the form in interactive state')

  .when('I submit the form')
  .then('I should see error on password field: "Enter a password"')
  .then('I should see error on passwordCheck field: "Enter the password again"')

  .then('I should see the form in error state')

  .when('I enter password into password field')
  .then('I should see no error on password field')

  .when('I enter invalid password into passwordCheck field')
  .then('I should see error on passwordCheck field: "Passwords must match"')

  .when('I enter password into passwordCheck field')
  .then('I should see no error on passwordCheck field')

  .when('I submit the form')
  .then('I should see the form in waiting state')
  .then('changePassword request should be made')

  .when('changePassword request fails with 400, error: "Invalid link."')
  .then('I should see the form in error state')
  .then('I should see form error: "This reset link is invalid"')
  .then('I should see submit button disabled')

  .back()
  .when('changePassword request fails with 404, error: "User not found."')
  .then('I should see the form in error state')
  .then('I should see form error: "This reset link is invalid"')
  .then('I should see submit button disabled')

  .back()
  .when('changePassword request fails with 500')
  .then('I should see the form in error state')
  .then('I should see form error: "Something went wrong"')
  .then('I should see submit button disabled')
  .then('the error should be captured')


  .scenario('Changing the password when the link is valid')

  .given('changePassword request is expected')

  .when('the component tree is mounted')
  .then('I should see the form in interactive state')

  .when('I enter invalid password into password field')
  .when('I enter invalid password into passwordCheck field')
  .when('I submit the form')
  .then('I should see the form in waiting state')
  .then('changePassword request should be made')

  .when('changePassword request fails with 400, error: "Password must be"')
  .then('I should see the form in error state')
  .then('I should see error on password field: "Password must be"')
  .then('I should see submit button disabled')

  .when('I enter password into password field')
  .then('I should see no error on password field')

  .when('I enter password into passwordCheck field')
  .then('I should see no error on passwordCheck field')

  .when('I submit the form')
  .when('changePassword request succeeds')
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
    const password = ctx.mounted.find(`${mockComponentSelector('TextField')}[name="password"]`).prop('value');
    ctx.mounted.find('form').simulate('submit');
    return { ...ctx, password };
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

  .step(/I should see no form error/, (ctx) => {
    const html = ctx.mounted.render();
    expect(html.find(`${mockComponentSelector('TextField')} + p`)).toHaveLength(0);
  })

  .step(/I should see the form in interactive state/, (ctx) => {
    const html = ctx.mounted.render();
    expect(html).toMatchSnapshot();

    const fields = ctx.mounted.find(mockComponentSelector('TextField'));
    const passwordField = fields.at(0);
    const passwordCheckField = fields.at(1);

    expect(passwordField.prop('name')).toBe('password');
    expect(passwordField.prop('disabled')).toBe(false);

    expect(passwordCheckField.prop('name')).toBe('passwordCheck');
    expect(passwordCheckField.prop('disabled')).toBe(false);

    expect(ctx.mounted.find(mockComponentSelector('RaisedButton', 'label')).text())
      .toBe('Change Password');
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

    const fields = ctx.mounted.find(mockComponentSelector('TextField'));
    const passwordField = fields.at(0);
    const passwordCheckField = fields.at(1);

    expect(passwordField.prop('disabled')).toBe(true);
    expect(passwordCheckField.prop('disabled')).toBe(true);

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
    const msgs = html.find('p');
    expect(msgs.eq(0).text()).toMatch('Your password has been changed');
    expect(msgs.eq(1).text()).toMatch('Now you can sign in');
    expect(msgs.eq(1).find(mockComponentSelector('Link')).attr('to')).toBe('/signin');
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
              <PassChange match={{ params: { link } }} />
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
