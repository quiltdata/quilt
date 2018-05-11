import memoize from 'lodash/memoize';
import PT from 'prop-types';
import React from 'react';
import { FormattedMessage as FM } from 'react-intl';
import { connect } from 'react-redux';
import { compose, setPropTypes } from 'recompose';
import { createStructuredSelector } from 'reselect';
import authWrapper from 'redux-auth-wrapper/authWrapper';

import Error from 'components/Error';
import Redirect from 'components/Redirect';
import { saveProps, restoreProps, composeComponent } from 'utils/reactTools';
import { selectLocation } from 'utils/router';

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
  ({ error, location: { pathname, search } }) => {
    const url = makeSignInURL(pathname + search);
    return error
      ? (
        <Error
          headline={<FM {...msg.error} />}
          detail={
            <FM
              {...msg.errorTry}
              values={{ link: <a href={url}><FM {...msg.errorTryLink} /></a> }}
            />
          }
        />
      )
      : <Redirect url={url} />;
  });

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
