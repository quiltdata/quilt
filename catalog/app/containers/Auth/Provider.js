import { fromJS } from 'immutable';
import pick from 'lodash/fp/pick';
import PT from 'prop-types';
import { Fragment } from 'react';
import { injectIntl } from 'react-intl';
import { connect } from 'react-redux';
import { defaultProps, mapProps, withHandlers, setPropTypes } from 'recompose';

import { push as notify } from 'containers/Notifications/actions';
import { composeComponent } from 'utils/reactTools';
import { injectReducer } from 'utils/ReducerInjector';
import { injectSaga } from 'utils/SagaInjector';

import { REDUX_KEY } from './constants';
import msg from './messages';
import reducer from './reducer';
import saga from './saga';


const ActionPattern = PT.oneOfType([PT.string, PT.func]);

/**
 * Provider component for the authentication system.
 */
export default composeComponent('Auth.Provider',
  setPropTypes({
    /**
     * Determines on which actions to fire the check logic.
     */
    checkOn: PT.oneOfType([ActionPattern, PT.arrayOf(ActionPattern)]),
    /**
     * Storage instance used to persist tokens and user data.
     */
    storage: PT.shape({
      set: PT.func.isRequired,
      remove: PT.func.isRequired,
      load: PT.func.isRequired,
    }),
    /**
     * The API URL.
     */
    api: PT.string.isRequired,
    /**
     * Expected API latency in seconds.
     */
    latency: PT.number,
    /**
     * Where to redirect after sign-out.
     */
    signOutRedirect: PT.string,
    /**
     * Where to redirect after sign-in by default (if no `next` param provided).
     */
    signInRedirect: PT.string,
  }),
  defaultProps({
    latency: 20,
    signOutRedirect: '/',
    signInRedirect: '/',
  }),
  injectIntl,
  connect(undefined, undefined, undefined, { pure: false }),
  withHandlers({
    storeTokens: ({ storage }) => (tokens) => storage.set('tokens', tokens),
    forgetTokens: ({ storage }) => () => storage.remove('tokens'),
    storeUser: ({ storage }) => (user) => storage.set('user', user),
    forgetUser: ({ storage }) => () => storage.remove('user'),
    onAuthLost: ({ intl, dispatch }) => () => {
      dispatch(notify(intl.formatMessage(msg.notificationAuthLost)));
    },
    onAuthError: ({ intl, dispatch }) => () => {
      dispatch(notify(intl.formatMessage(msg.notificationAuthError)));
    },
  }),
  injectReducer(REDUX_KEY, reducer, ({ storage, signInRedirect, signOutRedirect }) =>
    fromJS(storage.load())
      .filter(Boolean)
      .update((s) =>
        s.set('state', s.getIn(['user', 'current_user']) ? 'SIGNED_IN' : 'SIGNED_OUT'))
      .set('signInRedirect', signInRedirect)
      .set('signOutRedirect', signOutRedirect)),
  injectSaga(REDUX_KEY, saga),
  mapProps(pick(['children'])),
  Fragment);
