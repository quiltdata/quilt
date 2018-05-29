import { fromJS } from 'immutable';
import pick from 'lodash/fp/pick';
import PT from 'prop-types';
import { Fragment } from 'react';
import { injectIntl } from 'react-intl';
import { connect } from 'react-redux';
import { mapProps, withHandlers, withProps, setPropTypes } from 'recompose';

import { push as notify } from 'containers/Notifications/actions';
import { composeComponent } from 'utils/reactTools';
import { injectReducer } from 'utils/ReducerInjector';
import { injectSaga } from 'utils/SagaInjector';
import * as storage from 'utils/storage';

import { REDUX_KEY } from './constants';
import msg from './messages';
import reducer from './reducer';
import saga from './saga';


const ActionPattern = PT.oneOfType([PT.string, PT.func]);

export default composeComponent('Auth.Provider',
  injectIntl,
  connect(undefined, undefined, undefined, { pure: false }),
  setPropTypes({
    intl: PT.shape({
      formatMessage: PT.func.isRequired,
    }).isRequired,
    dispatch: PT.func.isRequired,
    checkOn: PT.oneOfType([ActionPattern, PT.arrayOf(ActionPattern)]),
  }),
  withProps({
    storeTokens: (tokens) => storage.set('tokens', tokens),
    forgetTokens: () => storage.remove('tokens'),
    storeUser: (user) => storage.set('user', user),
    forgetUser: () => storage.remove('user'),
  }),
  withHandlers({
    onAuthLost: ({ intl, dispatch }) => () => {
      dispatch(notify(intl.formatMessage(msg.notificationAuthLost)));
    },
    onAuthError: ({ intl, dispatch }) => () => {
      dispatch(notify(intl.formatMessage(msg.notificationAuthError)));
    },
  }),
  injectReducer(REDUX_KEY, reducer, () =>
    fromJS(storage.load()).filter(Boolean).update((s) =>
      s.set('state', s.getIn(['user', 'current_user']) ? 'SIGNED_IN' : 'SIGNED_OUT'))),
  injectSaga(REDUX_KEY, saga),
  mapProps(pick(['children'])),
  Fragment);
