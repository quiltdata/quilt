import React, { Fragment } from 'react';
import { FormattedMessage as FM } from 'react-intl';
import { connect } from 'react-redux';
import { Redirect } from 'react-router-dom';
import { withHandlers, withState } from 'recompose';
import { createStructuredSelector } from 'reselect';

import Lifecycle from 'components/Lifecycle';
import Working from 'components/Working';
import defer from 'utils/defer';
import { captureError } from 'utils/errorReporting';
import { composeComponent } from 'utils/reactTools';

import { signOut } from './actions';
import msg from './messages';
import * as selectors from './selectors';
import { makeSignOutURL } from './util';

export default composeComponent('Auth.SignOut',
  connect(createStructuredSelector({
    authenticated: selectors.authenticated,
    waiting: selectors.waiting,
  })),
  withState('error', 'setError', undefined),
  withHandlers({
    doSignOut: ({ dispatch, setError }) => () => {
      const result = defer();
      dispatch(signOut(result.resolver));
      result.promise.catch((e) => {
        console.log('error signing out', e);
        setError(e);
        // TODO: notification
        captureError(e);
      });
    },
  }),
  ({ waiting, authenticated, error, doSignOut }) => (
    <Fragment>
      {!error && !waiting && authenticated && <Lifecycle willMount={doSignOut} />}
      {!authenticated && <Redirect to={makeSignOutURL()} />}
      {error
        // TODO
        ? <h1>error: {error.toString()}</h1>
        : <Working><FM {...msg.signOutWaiting} /></Working>
      }
    </Fragment>
  ));
