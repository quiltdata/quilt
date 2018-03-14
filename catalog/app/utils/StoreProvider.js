import PT from 'prop-types';
import React from 'react';
import { Provider as ReduxProvider } from 'react-redux';
import { setPropTypes } from 'recompose';

import { composeComponent } from 'utils/reactTools';
import { ReducerInjector } from 'utils/ReducerInjector';
import { SagaInjector } from 'utils/SagaInjector';

export default composeComponent('StoreProvider',
  setPropTypes({
    store: PT.object.isRequired,
  }),
  ({ store, children }) => (
    <ReduxProvider store={store}>
      <ReducerInjector inject={store.injectReducer}>
        <SagaInjector run={store.runSaga}>
          {children}
        </SagaInjector>
      </ReducerInjector>
    </ReduxProvider>
  ));
