import React from 'react';
import { shallow, mount } from 'enzyme';
import { FormattedMessage, defineMessages } from 'react-intl';
import { Provider } from 'react-redux';
import { browserHistory } from 'react-router';

import { ReducerInjector } from 'utils/ReducerInjector';

import LanguageProvider from '../index';
import configureStore from '../../../store';

import { translationMessages } from '../../../i18n';

const messages = defineMessages({
  someMessage: {
    id: 'some.id',
    defaultMessage: 'This is some default message',
    en: 'This is some en message',
  },
});

describe('<LanguageProvider />', () => {
  let store;

  beforeAll(() => {
    store = configureStore({}, browserHistory);
  });

  it('should render its children', () => {
    const children = (<h1>Test</h1>);
    // eslint-disable-next-line function-paren-newline
    const renderedComponent = shallow(
      <Provider store={store}>
        <ReducerInjector inject={store.injectReducer}>
          <LanguageProvider messages={messages} locale="en">
            {children}
          </LanguageProvider>
        </ReducerInjector>
      </Provider>
    ); // eslint-disable-line function-paren-newline
    expect(renderedComponent.contains(children)).toBe(true);
  });

  it('should render the default language messages', () => {
    // eslint-disable-next-line function-paren-newline
    const renderedComponent = mount(
      <Provider store={store}>
        <ReducerInjector inject={store.injectReducer}>
          <LanguageProvider messages={translationMessages}>
            <FormattedMessage {...messages.someMessage} />
          </LanguageProvider>
        </ReducerInjector>
      </Provider>
    ); // eslint-disable-line function-paren-newline
    expect(renderedComponent.contains(<FormattedMessage {...messages.someMessage} />)).toBe(true);
  });
});
