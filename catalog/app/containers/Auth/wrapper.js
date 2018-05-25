import memoize from 'lodash/memoize';
import RaisedButton from 'material-ui/RaisedButton';
import PT from 'prop-types';
import React, { Fragment } from 'react';
import { FormattedMessage as FM } from 'react-intl';
import { connect } from 'react-redux';
import { Redirect } from 'react-router-dom';
import { compose, setPropTypes, withHandlers } from 'recompose';
import { createStructuredSelector } from 'reselect';
import authWrapper from 'redux-auth-wrapper/authWrapper';

import Error from 'components/Error';
import { saveProps, restoreProps, composeComponent } from 'utils/reactTools';
import { selectLocation } from 'utils/router';

import * as errors from './errors';
import msg from './messages';
import * as selectors from './selectors';
import { makeSignInURL } from './util';

const Failure = composeComponent('Auth.Wrapper.Failure',
  setPropTypes({
    error: PT.object,
    location: PT.shape({
      pathname: PT.string.isRequired,
      search: PT.string.isRequired,
    }).isRequired,
  }),
  withHandlers({
    retry: ({ dispatch, error }) => () => {
      console.log('retry', error);
      // TODO: dispatch check() or smth
      //if forbidden -> go to sign-in
      //if internal -> dispatch check to
    },
  }),
  ({ error, location: { pathname, search }, retry }) =>
    error
      ? (
        // TODO: proper messages
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
      )
      : <Redirect to={makeSignInURL(pathname + search)} />);

export default memoize(compose(
  saveProps(),
  connect(createStructuredSelector({
    isAuthenticated: selectors.authenticated,
    error: selectors.error,
    location: selectLocation,
  }), undefined, undefined, { pure: false }),
  authWrapper({
    FailureComponent: Failure,
    wrapperDisplayName: 'Auth.Wrapper',
  }),
  restoreProps(),
));
