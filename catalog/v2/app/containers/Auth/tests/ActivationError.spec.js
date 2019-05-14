import createHistory from 'history/createMemoryHistory';
import { fromJS } from 'immutable';
import React from 'react';

import LanguageProvider from 'containers/LanguageProvider';
import { translationMessages as messages } from 'i18n';
import StoreProvider from 'utils/StoreProvider';
import configureStore from 'store';

import feature from 'testing/feature';
import reactSteps from 'testing/react';

import { ActivationError } from '..';

jest.mock('constants/config');


const setup = () => {
  const history = createHistory({ initialEntries: ['/'] });
  const store = configureStore(fromJS({}), history);
  const tree = (
    <StoreProvider store={store}>
      <LanguageProvider messages={messages}>
        <ActivationError />
      </LanguageProvider>
    </StoreProvider>
  );
  return { tree };
};

const screens = {
  error: (html) => {
    expect(html.find('h1').text()).toBe('Activation Error');
    expect(html.find('p').text()).toMatch(/Something.+activation[^]+support@quiltdata\.io/m);
  },
};

const steps = [
  ...reactSteps({ setup, screens }),
];


feature('containers/Auth/ActivationError')
  .scenario('Mounting the component')

  .when('the component tree is mounted')
  .then('I should see the error screen')
  .then('the rendered markup should match the snapshot')

  .steps(steps)
  .run();
