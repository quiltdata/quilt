/* App */
import { fromJS } from 'immutable';
import PropTypes from 'prop-types';
import React from 'react';
import { connect } from 'react-redux';
import { lifecycle, setPropTypes } from 'recompose';
import { createStructuredSelector } from 'reselect';

import AuthBar from 'components/AuthBar';
import status from 'constants/api';
import CoreLF from 'components/CoreLF';
import Footer from 'components/Footer';
import { Pad } from 'components/LayoutHelpers';
import Notifications from 'containers/Notifications';
import { injectReducer } from 'utils/ReducerInjector';
import { injectSaga } from 'utils/SagaInjector';
import { composeComponent } from 'utils/reactTools';
import { loadState } from 'utils/storage';

import { routerStart } from './actions';
import { REDUX_KEY } from './constants';
import reducer from './reducer';
import saga from './saga';
import {
  makeSelectAuth,
  makeSelectSearchText,
  makeSelectSignedIn,
  makeSelectUserName,
} from './selectors';

export default composeComponent('App',
  injectSaga(REDUX_KEY, saga),
  injectReducer(REDUX_KEY, reducer, () => {
    const { RESPONSE, TOKENS } = loadState();
    return fromJS({ user: { auth: { response: RESPONSE, tokens: TOKENS } } });
  }),
  connect(createStructuredSelector({
    auth: makeSelectAuth(),
    searchText: makeSelectSearchText(),
    signedIn: makeSelectSignedIn(),
    name: makeSelectUserName(),
  })),
  setPropTypes({
    auth: PropTypes.object,
    children: PropTypes.node,
    dispatch: PropTypes.func.isRequired,
    searchText: PropTypes.string,
    signedIn: PropTypes.bool,
    name: PropTypes.string,
  }),
  lifecycle({
    componentWillMount() {
      const { dispatch } = this.props;
      const { pathname, search } = window.location;
      // we need to fire on first mount since react-router-redux does not fire
      // a location change on first entry into a route (e.g. cold JS start or
      // hard link)
      dispatch(routerStart({ pathname, search }));
    }
  }),
  // eslint-disable-next-line object-curly-newline
  ({ auth, children, dispatch, name, searchText, signedIn }) => (
    <CoreLF>
      <AuthBar
        dispatch={dispatch}
        error={auth.error}
        signedIn={signedIn}
        name={name}
        searchText={searchText}
        waiting={auth.status === status.WAITING}
      />
      <Pad top left right bottom>
        { children }
      </Pad>
      <Footer />
      <Notifications />
    </CoreLF>
  ));
