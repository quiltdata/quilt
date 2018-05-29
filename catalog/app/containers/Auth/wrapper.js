import memoize from 'lodash/memoize';
import RaisedButton from 'material-ui/RaisedButton';
import React from 'react';
import { FormattedMessage as FM } from 'react-intl';
import { connect } from 'react-redux';
import { Redirect } from 'react-router-dom';
import {
  branch,
  renderComponent,
  withHandlers,
} from 'recompose';
import { createStructuredSelector } from 'reselect';

import Error from 'components/Error';
import Working from 'components/Working';
import { saveProps, restoreProps, composeHOC } from 'utils/reactTools';
import { selectLocation } from 'utils/router';

import { check } from './actions';
import { NotAuthenticated } from './errors';
import msg from './messages';
import * as selectors from './selectors';
import { makeSignInURL } from './util';

export default memoize(composeHOC('Auth.Wrapper',
  saveProps(),
  connect(createStructuredSelector({
    authenticated: selectors.authenticated,
    error: selectors.error,
    waiting: selectors.waiting,
    location: selectLocation,
  }), undefined, undefined, { pure: false }),
  withHandlers({
    retry: ({ dispatch }) => () => {
      dispatch(check());
    },
  }),
  branch((p) => p.error && !(p.error instanceof NotAuthenticated),
    renderComponent(({ retry }) => (
      <Error
        headline={<FM {...msg.wrapperFailureHeading} />}
        detail={
          <span>
            <FM {...msg.wrapperFailureDescription} />
            <RaisedButton
              onClick={retry}
              label={<FM {...msg.wrapperFailureRetry} />}
            />
          </span>
        }
      />
    ))),
  branch((p) => p.waiting,
    renderComponent(() =>
      <Working><FM {...msg.wrapperWorking} /></Working>)),
  branch((p) => !p.authenticated,
    renderComponent(({ location: { pathname, search } }) =>
      <Redirect to={makeSignInURL(pathname + search)} />)),
  restoreProps()));
