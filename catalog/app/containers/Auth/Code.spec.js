/* eslint-disable import/first, global-require */

import { mount } from 'enzyme';
import createHistory from 'history/createMemoryHistory';
import { fromJS } from 'immutable';
import React from 'react';

import LanguageProvider from 'containers/LanguageProvider';
import { translationMessages as messages } from 'i18n';
import StoreProvider from 'utils/StoreProvider';
import configureStore from 'store';

import feature from 'testing/feature';
import { mockComponentSelector } from 'testing/util';

import {
  Provider as AuthProvider,
  actions,
  errors,
  Code,
} from '.';

import {
  api,
  date,
  tokens,
} from './tests/support/fixtures';
import requestsSteps from './tests/support/requests';
import storageSteps from './tests/support/storage';

jest.mock('constants/config', () => ({}));

jest.mock('utils/time');
import { timestamp } from 'utils/time';

jest.mock('utils/clipboard');
import copyToClipboard from 'utils/clipboard';

jest.mock('utils/errorReporting');
import { captureError } from 'utils/errorReporting';

jest.mock('material-ui/RaisedButton', () =>
  require('testing/util').mockComponent('RaisedButton', {
    children: ['label'],
  }));
jest.mock('components/Working', () =>
  require('testing/util').mockComponent('Working'));


const requests = {
  getCode: {
    setup: () => ['getOnce', '/api/code'],
    expect: () =>
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: `Bearer ${tokens.token}`,
        }),
      }),
    success: () => ({ code: 'the code' }),
  },
};

feature('containers/Auth/Code')
  .given('storage has current auth data')
  .given('getCode request is expected')


  .scenario('Mounting the component, getCode request succeeds')

  .when('the component tree is mounted')
  .then('getCode action should be dispatched')
  .then('the user should see the placeholder screen')

  .when('getCode request succeeds')
  .then('the user should see the code screen with the copy button')

  .when('copy button is clicked')
  .then('the code should be copied to the clipboard')


  .scenario('Mounting the component, getCode request fails')

  .when('the component tree is mounted')
  .when('getCode request fails with 500')
  .then('the user should see the error screen')
  .then('the error should be captured')

  .steps([...storageSteps, ...requestsSteps(requests)])

  .step(/getCode action should be dispatched/, (ctx) => {
    expect(ctx.store.dispatch).toBeCalledWith(expect.objectContaining({
      type: actions.getCode.type,
    }));
  })

  .step(/the user should see the placeholder screen/, (ctx) => {
    const html = ctx.mounted.render();
    expect(html.find(mockComponentSelector('Working')).text())
      .toMatch('Getting the code');
    expect(html).toMatchSnapshot();
  })

  .step(/the user should see the code screen with the copy button/, (ctx) => {
    const html = ctx.mounted.render();
    const { code } = ctx.requestResults.getCode;
    expect(html.find('div>div>h1+div').text()).toMatch(code);
    expect(html.find(mockComponentSelector('RaisedButton', 'label')).text())
      .toMatch('Copy');
    expect(html).toMatchSnapshot();
  })

  .step(/the user should see the error screen/, (ctx) => {
    const html = ctx.mounted.render();
    expect(html.find('div>p>span').text()).toMatch('Something went wrong');
    expect(html).toMatchSnapshot();
  })

  .step(/copy button is clicked/, (ctx) => {
    ctx.mounted.update().find(mockComponentSelector('RaisedButton')).simulate('click');
  })

  .step(/the code should be copied to the clipboard/, (ctx) => {
    const { code } = ctx.requestResults.getCode;
    expect(copyToClipboard).toBeCalledWith(code);
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
    const tree = (
      // we must wrap the tree into div, because enzyme doesn't support fragments
      // https://github.com/airbnb/enzyme/issues/1213
      <div>
        <StoreProvider store={store}>
          <LanguageProvider messages={messages}>
            <AuthProvider
              storage={storage}
              api={api}
            >
              <Code />
            </AuthProvider>
          </LanguageProvider>
        </StoreProvider>
      </div>
    );
    timestamp.mockReturnValue(date);
    const mounted = mount(tree);
    return { ...ctx, history, store, tree, mounted };
  })

  .run();
