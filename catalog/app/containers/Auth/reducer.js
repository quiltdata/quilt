import id from 'lodash/identity';
import { fromJS } from 'immutable';

import { get } from 'utils/immutableTools';
import {
  withInitialState,
  handleActions,
  handleResult,
  handleTransitions,
  combine,
  unset,
  noop,
} from 'utils/reduxTools';

import { actions } from './constants';


const initial = {
  state: 'SIGNED_OUT',
};

export default withInitialState(fromJS(initial), handleTransitions(get('state'), {
  SIGNED_OUT: handleActions({
    [actions.SIGN_IN]: combine({
      state: 'SIGNING_IN',
    }),
  }),
  SIGNING_IN: handleActions({
    [actions.SIGN_IN_RESULT]: handleResult({
      resolve: combine({
        state: 'SIGNED_IN',
        user: (p) => fromJS(p.user),
        tokens: (p) => fromJS(p.tokens),
      }),
      reject: combine({
        state: 'SIGNED_OUT',
        error: id,
      }),
    }),
  }),
  SIGNED_IN: handleActions({
    [actions.SIGN_OUT_RESULT]: handleResult({
      resolve: combine({
        state: 'SIGNED_OUT',
        tokens: unset,
        user: unset,
      }),
      reject: combine({
        error: id,
      }),
    }),
    [actions.REFRESH]: {
      state: 'REFRESHING',
    },
    [actions.AUTH_LOST]: {
      state: 'SIGNED_OUT',
      error: id,
      tokens: unset,
      user: unset,
    },
  }),
  REFRESHING: handleActions({
    [actions.REFRESH_SUCCESS]: combine({
      state: 'SIGNED_IN',
      tokens: ({ tokens }) => fromJS()(tokens),
      user: ({ user }) => user ? fromJS()(user) : noop,
    }),
    [actions.REFRESH_ERROR]: combine({
      state: 'SIGNED_OUT',
      error: id,
      tokens: unset,
      user: unset,
    }),
  }),
}));
