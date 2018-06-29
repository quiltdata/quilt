import createHistory from 'history/createMemoryHistory';
import { fromJS } from 'immutable';
import React from 'react';

import LanguageProvider from 'containers/LanguageProvider';
import { translationMessages as messages } from 'i18n';
import copyToClipboard from 'utils/clipboard';
import StoreProvider from 'utils/StoreProvider';
import configureStore from 'store';

import feature from 'testing/feature';
import errorSteps from 'testing/error';
import reactSteps from 'testing/react';
import requestsSteps from 'testing/requests';
import storageSteps from 'testing/storage';
import { mockComponentSelector } from 'testing/util';

import {
  Provider as AuthProvider,
  actions,
  errors,
  Code,
} from '..';

import { api, tokens, datasets } from './fixtures';

jest.mock('material-ui/RaisedButton');

jest.mock('components/Working');
jest.mock('constants/config');
jest.mock('utils/clipboard');
jest.mock('utils/errorReporting');
jest.mock('utils/time');


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

const screens = {
  placeholder: (html) => {
    expect(html.find(mockComponentSelector('Working')).text())
      .toMatch('Getting the code');
  },
  'copy-code': (html, ctx) => {
    const { code } = ctx.requestResults.getCode;
    expect(html.find('div>div>h1+div').text()).toMatch(code);
    expect(html.find(mockComponentSelector('RaisedButton', 'label')).text())
      .toMatch('Copy');
  },
  error: (html) => {
    expect(html.find('div>p>span').text()).toMatch('Something went wrong');
  },
};

const setup = (ctx) => {
  const history = createHistory({ initialEntries: ['/'] });
  const store = configureStore(fromJS({}), history);
  jest.spyOn(store, 'dispatch');
  const tree = (
    // we must wrap the tree into div, because enzyme doesn't support fragments
    // https://github.com/airbnb/enzyme/issues/1213
    <div>
      <StoreProvider store={store}>
        <LanguageProvider messages={messages}>
          <AuthProvider
            storage={ctx.storage}
            api={api}
          >
            <Code />
          </AuthProvider>
        </LanguageProvider>
      </StoreProvider>
    </div>
  );
  return { tree, store };
};

const steps = [
  ...reactSteps({ setup, screens }),
  ...errorSteps(errors),
  ...requestsSteps(api, requests),
  ...storageSteps(datasets),
];


feature('containers/Auth/Code')
  .given('storage has current auth data')
  .given('getCode request is expected')


  .scenario('Mounting the component, getCode request succeeds')

  .when('the component tree is mounted')
  .then('getCode action should be dispatched')
  .then('I should see the placeholder screen')
  .then('the rendered markup should match the snapshot')

  .when('getCode request succeeds')
  .then('I should see the copy-code screen')
  .then('the rendered markup should match the snapshot')

  .when('copy button is clicked')
  .then('the code should be copied to the clipboard')


  .scenario('Mounting the component, getCode request fails')

  .when('the component tree is mounted')
  .when('getCode request fails with 500')
  .then('I should see the error screen')
  .then('the rendered markup should match the snapshot')
  .then('an AuthError error should be captured')


  .step(/getCode action should be dispatched/, (ctx) => {
    expect(ctx.store.dispatch).toBeCalledWith(expect.objectContaining({
      type: actions.getCode.type,
    }));
  })

  .step(/copy button is clicked/, (ctx) => {
    ctx.mounted.update().find(mockComponentSelector('RaisedButton')).simulate('click');
  })

  .step(/the code should be copied to the clipboard/, (ctx) => {
    const { code } = ctx.requestResults.getCode;
    expect(copyToClipboard).toBeCalledWith(code);
  })


  .steps(steps)

  .run();
