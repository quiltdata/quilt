import { parse } from 'query-string';
import PT from 'prop-types';
import React from 'react';
import { FormattedMessage as FM, injectIntl } from 'react-intl';
import { connect } from 'react-redux';
import { replace } from 'react-router-redux';
import { setPropTypes, lifecycle } from 'recompose';

import Working from 'components/Working';
import { push as notify } from 'containers/Notifications/actions';
import { composeComponent } from 'utils/reactTools';
import redirect from 'utils/redirect';

import { signIn } from './actions';
import { ERROR_REDIRECT_PATH, ERROR_NOTIFICATION_TTL } from './constants';
import msg from './messages';
import { adjustTokensForLatency, makeSignInURL } from './util';


export default composeComponent('Auth.OAuth2Callback',
  injectIntl,
  connect(),
  setPropTypes({
    dispatch: PT.func.isRequired,
    location: PT.shape({
      search: PT.string.isRequired,
      hash: PT.string.isRequired,
    }).isRequired,
    intl: PT.shape({
      formatMessage: PT.func.isRequired,
    }).isRequired,
  }),
  lifecycle({
    componentWillMount() {
      const { dispatch, location: { hash, search }, intl } = this.props;

      const { next } = parse(search);
      // eslint-disable-next-line camelcase
      const { refresh_token, access_token, expires_at } = parse(hash);
      const tokens = adjustTokensForLatency({
        refresh_token,
        access_token,
        expires_at:
          // eslint-disable-next-line camelcase
          expires_at
            ? parseFloat(expires_at, 10)
            /* istanbul ignore next */
            : Infinity,
      });

      dispatch(signIn(tokens, {
        onSuccess: () => {
          dispatch(replace(next));
        },
        onError: () => {
          dispatch(notify(intl.formatMessage(msg.signInError), {
            ttl: ERROR_NOTIFICATION_TTL,
            action: {
              label: intl.formatMessage(msg.signInRetry),
              onClick: () => {
                /* istanbul ignore next */
                redirect(makeSignInURL(next));
              },
            },
          }));
          dispatch(replace(ERROR_REDIRECT_PATH));
        },
      }));
    },
  }),
  () => <Working><FM {...msg.signingIn} /></Working>);
