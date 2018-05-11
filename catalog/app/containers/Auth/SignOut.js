import React, { Fragment } from 'react';
import { FormattedMessage as FM } from 'react-intl';
import { connect } from 'react-redux';
import { push } from 'react-router-redux';
import { withHandlers } from 'recompose';
import { createStructuredSelector } from 'reselect';

import Lifecycle from 'components/Lifecycle';
import Working from 'components/Working';
import { composeComponent } from 'utils/reactTools';
import redirect from 'utils/redirect';

import { signOut } from './actions';
import msg from './messages';
import * as selectors from './selectors';
import { makeSignOutURL } from './util';

const isExternal = (url) => /^https?:/.test(url);

export default composeComponent('Auth.SignOut',
  connect(createStructuredSelector({
    authenticated: selectors.authenticated,
    waiting: selectors.waiting,
  })),
  withHandlers({
    afterSignOut: ({ dispatch }) => () => {
      const url = makeSignOutURL();
      /* istanbul ignore if */
      if (isExternal(url)) {
        redirect(url);
      } else {
        dispatch(push(url));
      }
    },
  }),
  withHandlers({
    doSignOut: ({ dispatch, authenticated, afterSignOut }) => () => {
      if (authenticated) {
        dispatch(signOut(afterSignOut));
      } else {
        afterSignOut();
      }
    },
  }),
  ({ waiting, doSignOut }) => (
    <Fragment>
      {waiting ? null : <Lifecycle willMount={doSignOut} />}
      <Working><FM {...msg.signingOut} /></Working>
    </Fragment>
  ));
