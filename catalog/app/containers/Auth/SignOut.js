import React, { Fragment } from 'react';
import { FormattedMessage as FM } from 'react-intl';
import { connect } from 'react-redux';
import { push } from 'react-router-redux';
import { withHandlers } from 'recompose';
import { createStructuredSelector } from 'reselect';

import Lifecycle from 'components/Lifecycle';
import Redirect from 'components/Redirect';
import Working from 'components/Working';
import defer from 'utils/defer';
import { composeComponent } from 'utils/reactTools';

import { signOut } from './actions';
import msg from './messages';
import * as selectors from './selectors';
import { makeSignOutURL } from './util';

export default composeComponent('Auth.SignOut',
  connect(createStructuredSelector({
    authenticated: selectors.authenticated,
    waiting: selectors.waiting,
    error: selectors.error,
  })),
  withHandlers({
    doSignOut: ({ dispatch }) => () => {
      const result = defer();
      dispatch(signOut(result.resolver));
      result.promise.catch((e) => {
        console.log('error signing out', e);
        // TODO: notification
        // TODO: captureError
      });
    },
  }),
  ({ waiting, authenticated, error, doSignOut }) => (
    <Fragment>
      {!waiting && authenticated && <Lifecycle willMount={doSignOut} />}
      {!authenticated && <Redirect to={makeSignOutURL()} />}
      {error
        // TODO
        ? <h1>error: {error}</h1>
        : <Working><FM {...msg.signingOut} /></Working>
      }
    </Fragment>
  ));
