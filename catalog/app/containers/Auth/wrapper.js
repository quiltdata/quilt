import memoize from 'lodash/memoize';
import RaisedButton from 'material-ui/RaisedButton';
import PT from 'prop-types';
import React, { Fragment } from 'react';
import { FormattedMessage as FM } from 'react-intl';
import { connect } from 'react-redux';
import { compose, setPropTypes, withHandlers } from 'recompose';
import { createStructuredSelector } from 'reselect';
import authWrapper from 'redux-auth-wrapper/authWrapper';

import Error from 'components/Error';
import Redirect from 'components/Redirect';
import { saveProps, restoreProps, composeComponent } from 'utils/reactTools';
import { selectLocation } from 'utils/router';

import msg from './messages';
import * as selectors from './selectors';
import { makeSignInURL } from './util';

// TODO: use Error subclass, e.g. InternalError, and check with instanceOf
const isInternal = (err) => !(err.response && err.response.status === 401);

const Failure = composeComponent('Auth.Wrapper.Failure',
  setPropTypes({
    error: PT.object,
    location: PT.shape({
      pathname: PT.string.isRequired,
      search: PT.string.isRequired,
    }).isRequired,
  }),
  withHandlers({
    retry: ({ dispatch }) => () => {
      console.log('retry', dispatch);
      // TODO: dispatch check() or smth
    },
  }),
  ({ error, location: { pathname, search }, retry }) =>
    error
      ? (
        // TODO: proper messages
        <Error
          headline={<FM {...msg[`error${isInternal(error) ? 'Internal' : 'Forbidden'}`]} />}
          detail={
            <span>
              <FM {...msg.errorTry} />
              <RaisedButton
                href={isInternal(error) ? undefined : makeSignInURL(pathname + search)}
                onClick={isInternal(error) ? retry : undefined}
                label={<FM {...msg.retry} />}
              />
            </span>
          }
        />
      )
      : <Redirect url={makeSignInURL(pathname + search)} />);

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
