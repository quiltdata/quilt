/* eslint-disable import/first */

import { mount } from 'enzyme';
import createHistory from 'history/createMemoryHistory';
import { fromJS } from 'immutable';
import React from 'react';

import LanguageProvider from 'containers/LanguageProvider';
import { translationMessages as messages } from 'i18n';
import StoreProvider from 'utils/StoreProvider';
import configureStore from 'store';

import feature from 'testing/feature';

import { ActivationError } from '..';

jest.mock('constants/config', () => ({}));


feature('containers/Auth/ActivationError')
  .scenario('Mounting the component')

  .when('the component tree is mounted')
  .then('the user should see the error message')

  .step(/the component tree is mounted/, (ctx) => {
    const history = createHistory({ initialEntries: ['/'] });
    const store = configureStore(fromJS({}), history);
    const tree = (
      <StoreProvider store={store}>
        <LanguageProvider messages={messages}>
          <ActivationError />
        </LanguageProvider>
      </StoreProvider>
    );
    const mounted = mount(tree);
    return { ...ctx, mounted };
  })

  .step(/the user should see the error message/, (ctx) => {
    const html = ctx.mounted.render();
    expect(html.find('h1').text()).toBe('Activation Error');
    expect(html.find('p').text()).toMatch(/Oops.+activating[^]+support@quiltdata\.io/m);
    expect(html).toMatchSnapshot();
  })

  .run();
