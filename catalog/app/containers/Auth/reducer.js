import id from 'lodash/identity';

import { get, fromJS } from 'utils/immutableTools';
import { withInitialState, handleTransitions, unset, noop } from 'utils/reduxTools';

import { actions } from './constants';


const initial = {
  state: 'SIGNED_OUT',
};

export default withInitialState(fromJS()(initial), handleTransitions(get('state'), {
  SIGNED_OUT: {
    [actions.SIGN_IN]: {
      state: 'SIGNING_IN',
      tokens: fromJS(),
    },
  },
  SIGNING_IN: {
    [actions.SIGN_IN_SUCCESS]: {
      state: 'SIGNED_IN',
      user: fromJS(),
    },
    [actions.SIGN_IN_ERROR]: {
      state: 'SIGNED_OUT',
      error: id,
      tokens: unset,
    },
  },
  SIGNED_IN: {
    [actions.SIGN_OUT]: {
      state: 'SIGNED_OUT',
      tokens: unset,
      user: unset,
    },
    [actions.REFRESH]: {
      state: 'REFRESHING',
    },
    [actions.AUTH_LOST]: {
      state: 'SIGNED_OUT',
      error: id,
      tokens: unset,
      user: unset,
    },
  },
  REFRESHING: {
    [actions.REFRESH_SUCCESS]: {
      state: 'SIGNED_IN',
      tokens: ({ tokens }) => fromJS()(tokens),
      user: ({ user }) => user ? fromJS()(user) : noop,
    },
    [actions.REFRESH_ERROR]: {
      state: 'SIGNED_OUT',
      error: id,
      tokens: unset,
      user: unset,
    },
  },
}));
