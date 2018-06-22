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
  SignIn,
  errors,
} from '..';

import {
  api,
  date,
  tokensRaw,
  user,
} from './support/fixtures';
import requestsSteps from './support/requests';
import storageSteps from './support/storage';

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
  Redirect: require('testing/util').mockComponent('Redirect'),
}));

jest.mock('components/Spinner', () =>
  require('testing/util').mockComponent('Spinner'));

const paths = {
  signIn: '/signin',
  page1: '/page1',
  page2: '/page2',
};
const signInRedirect = paths.page1;


const values = {
  'invalid password': 'invalid',
  'valid password': 'valid',
  username: 'bob',
};

const requests = {
  signIn: {
    setup: () => ['post', '/login'],
    expect: (ctx) =>
      expect.objectContaining({
        body: JSON.stringify(ctx.credentials),
      }),
    success: () => tokensRaw,
  },
  fetchUser: {
    setup: () => ['getOnce', '/api-root'],
    success: () => user,
  },
};

feature('containers/Auth/SignIn')
  .scenario('Mounting the component when user is authenticated')

  .given('storage has current auth data')
  .given('next param is set to page2')

  .when('the component tree is mounted')
  .then('I should be redirected to page2')


  .scenario('Signing in')

  .given('storage has empty auth data')
  .given('signIn request is expected')
  .given('fetchUser request is expected')

  .when('the component tree is mounted')
  .then('I should see the sign-in form in interactive state')

  .when('I submit the form')
  .then('I should see error on username field: "Enter your username"')
  .then('I should see error on password field: "Enter your password"')
  .then('I should see the sign-in form in error state')

  .when('I enter username into username field')
  .then('I should see no error on username field')

  .when('I enter invalid password into password field')
  .then('I should see no error on password field')
  .then('I should see submit button enabled')

  .when('I submit the form')
  .then('I should see the sign-in form in waiting state')

  .when('signIn request fails with 200, error: "Login attempt failed"')
  .then('I should see the sign-in form in error state')
  .then('I should see form error: "Invalid credentials"')
  .then('I should see submit button disabled')

  .when('I enter valid password into password field')
  .then('I should see no form error')
  .then('I should see submit button enabled')

  .when('I submit the form')
  .when('signIn request fails with 500')
  .then('I should see form error: "Something went wrong"')
  .then('I should see submit button disabled')
  .then('the error should be captured')

  .when('I re-enter valid password into password field')
  .then('I should see no form error')
  .then('I should see submit button enabled')

  .when('I submit the form')
  .when('signIn request succeeds')
  .when('fetchUser request succeeds')
  .then('I should be redirected to page1')

  .steps([...storageSteps, ...requestsSteps(requests)])

  .step(/I should be redirected to (.+)/, (ctx, path) => {
    ctx.mounted.update();
    expect(ctx.mounted.find(mockComponentSelector('Redirect')).prop('to')).toBe(paths[path]);
  })

  .step(/next param is set to (.+)/, (ctx, path) => ({
    ...ctx,
    next: paths[path],
  }))

  .step(/I (re-)?enter (.+) into (.+) field/, (ctx, re, valueName, fieldName) => {
    const field = ctx.mounted.find(`${mockComponentSelector('TextField')}[name="${fieldName}"]`);
    const value = values[valueName];
    field.simulate('focus');
    if (re) field.simulate('change', { target: { value: '' } });
    field.simulate('change', { target: { value } });
    field.simulate('blur');
  })

  .step(/I submit the form/, (ctx) => {
    const credentials = {
      username: ctx.mounted.find(`${mockComponentSelector('TextField')}[name="username"]`).prop('value'),
      password: ctx.mounted.find(`${mockComponentSelector('TextField')}[name="password"]`).prop('value'),
    };
    ctx.mounted.find('form').simulate('submit');
    return { ...ctx, credentials };
  })

  .step(/I should see no error on (.+) field/, (ctx, fieldName) => {
    const field = ctx.mounted
      .find(`${mockComponentSelector('TextField')}[name="${fieldName}"]`);
    expect(field.find(getPropName('errorText'))).toHaveLength(0);
  })

  .step(/I should see error on (.+) field: "(.+)"/, (ctx, fieldName, errorText) => {
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

  .step(/I should see the sign-in form in interactive state/, (ctx) => {
    const html = ctx.mounted.render();
    expect(html).toMatchSnapshot();

    const fields = ctx.mounted.find(mockComponentSelector('TextField'));
    const usernameField = fields.at(0);
    const passwordField = fields.at(1);

    expect(usernameField.prop('name')).toBe('username');
    expect(usernameField.prop('disabled')).toBe(false);

    expect(passwordField.prop('name')).toBe('password');
    expect(passwordField.prop('disabled')).toBe(false);

    expect(ctx.mounted.find(mockComponentSelector('RaisedButton', 'label')).text())
      .toBe('Sign in');
    expect(ctx.mounted.find(mockComponentSelector('RaisedButton')).prop('disabled'))
      .toBe(false);
  })

  .step(/I should see the sign-in form in error state/, (ctx) => {
    const html = ctx.mounted.render();
    expect(html).toMatchSnapshot();

    expect(ctx.mounted.find(mockComponentSelector('RaisedButton')).prop('disabled'))
      .toBe(true);
  })

  .step(/I should see the sign-in form in waiting state/, (ctx) => {
    const html = ctx.mounted.render();
    expect(html).toMatchSnapshot();

    const fields = ctx.mounted.find(mockComponentSelector('TextField'));
    const usernameField = fields.at(0);
    const passwordField = fields.at(1);

    expect(usernameField.prop('disabled')).toBe(true);
    expect(passwordField.prop('disabled')).toBe(true);

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

  .step(/the error should be captured/, () => {
    expect(captureError).toBeCalledWith(expect.any(errors.AuthError));
  })

  .step(/the component tree is mounted/, (ctx) => {
    const history = createHistory({ initialEntries: ['/'] });
    const store = configureStore(fromJS({}), history);
    jest.spyOn(store, 'dispatch');
    const storage = ctx.storage || {
      load: () => ({}),
      set: () => {},
      remove: () => {},
    };
    const search = ctx.next ? `?next=${encodeURIComponent(ctx.next)}` : '';
    const tree = (
      <StoreProvider store={store}>
        <FormProvider>
          <LanguageProvider messages={messages}>
            <AuthProvider
              storage={storage}
              api={api}
              signInRedirect={signInRedirect}
            >
              <SignIn location={{ search }} />
            </AuthProvider>
          </LanguageProvider>
        </FormProvider>
      </StoreProvider>
    );
    timestamp.mockReturnValue(date);
    const mounted = mount(tree);
    return { ...ctx, history, store, tree, mounted };
  })

  .run();
