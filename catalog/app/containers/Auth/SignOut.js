// @flow

import React, { Fragment } from 'react';
import { FormattedMessage as FM } from 'react-intl';
import { connect } from 'react-redux';
import { Redirect } from 'react-router-dom';
import { withHandlers } from 'recompose';
import { createStructuredSelector } from 'reselect';

import Lifecycle from 'components/Lifecycle';
import Working from 'components/Working';
import defer from 'utils/defer';
import { captureError } from 'utils/errorReporting';
import { composeComponent } from 'utils/reactTools';

import { signOut } from './actions';
import msg from './messages';
import * as selectors from './selectors';

export default composeComponent('Auth.SignOut',
  connect(createStructuredSelector({
    authenticated: selectors.authenticated,
    waiting: selectors.waiting,
    signOutRedirect: selectors.signOutRedirect,
  })),
  withHandlers({
    doSignOut: ({ dispatch }) => () => {
      const result = defer();
      dispatch(signOut(result.resolver));
      result.promise.catch(captureError);
    },
  }),
  ({ waiting, authenticated, signOutRedirect, doSignOut }) => (
    <Fragment>
      {!waiting && authenticated && <Lifecycle willMount={doSignOut} />}
      {!authenticated && <Redirect to={signOutRedirect} />}
      <Working><FM {...msg.signOutWaiting} /></Working>
    </Fragment>
  ));
