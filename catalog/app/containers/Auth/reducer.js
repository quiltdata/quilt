import id from 'lodash/identity'
import { fromJS } from 'immutable'

import { get } from 'utils/immutableTools'
import {
  withInitialState,
  handleActions,
  handleResult,
  handleTransitions,
  combine,
  unset,
  noop,
} from 'utils/reduxTools'

import { actions } from './constants'

const initial = {
  state: 'SIGNED_OUT',
}

export default withInitialState(
  fromJS(initial),
  handleTransitions(get('state'), {
    SIGNED_OUT: handleActions({
      [actions.SIGN_IN]: combine({
        state: 'SIGNING_IN',
        error: unset,
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
        }),
      }),
    }),
    SIGNED_IN: handleActions({
      [actions.SIGN_OUT_RESULT]: combine({
        state: 'SIGNED_OUT',
        tokens: unset,
        user: unset,
      }),
      [actions.REFRESH]: combine({
        state: 'REFRESHING',
        error: unset,
      }),
      [actions.AUTH_LOST]: combine({
        state: 'SIGNED_OUT',
        error: id,
        tokens: unset,
        user: unset,
      }),
    }),
    REFRESHING: handleActions({
      [actions.REFRESH_RESULT]: handleResult({
        resolve: combine({
          state: 'SIGNED_IN',
          tokens: ({ tokens }) => fromJS(tokens),
          user: ({ user }) => (user ? fromJS(user) : noop),
        }),
        reject: combine({
          state: 'SIGNED_OUT',
          error: id,
          tokens: unset,
          user: unset,
        }),
      }),
    }),
  }),
)
