/* App */
import { fromJS } from 'immutable';
import PropTypes from 'prop-types';
import React from 'react';
import { connect } from 'react-redux';
import { lifecycle, setPropTypes } from 'recompose';
import { createStructuredSelector } from 'reselect';

import CoreLF from 'components/CoreLF';
import Footer from 'components/Footer';
import { Pad } from 'components/LayoutHelpers';
import AuthBar from 'containers/AuthBar';
import Notifications from 'containers/Notifications';
import { injectReducer } from 'utils/ReducerInjector';
import { injectSaga } from 'utils/SagaInjector';
import { composeComponent } from 'utils/reactTools';
import { loadState } from 'utils/storage';

import { routerStart } from './actions';
import { REDUX_KEY } from './constants';
import reducer from './reducer';
import saga from './saga';

export default composeComponent('App',
  injectReducer(REDUX_KEY, reducer, () => {
    const { RESPONSE, TOKENS } = loadState();
    return fromJS({ user: { auth: { response: RESPONSE, tokens: TOKENS } } });
  }),
  injectSaga(REDUX_KEY, saga),
  connect(),
  setPropTypes({
    children: PropTypes.node,
    dispatch: PropTypes.func.isRequired,
  }),
  lifecycle({
    componentWillMount() {
      const { dispatch } = this.props;
      const { pathname, search } = window.location;
      // we need to fire on first mount since react-router-redux does not fire
      // a location change on first entry into a route (e.g. cold JS start or
      // hard link)
      dispatch(routerStart({ pathname, search }));
    },
  }),
  ({ children }) => (
    <CoreLF>
      <AuthBar />
      <Pad top left right bottom>
        { children }
      </Pad>
      <Footer />
      <Notifications />
    </CoreLF>
  ));
