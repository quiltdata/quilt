import * as R from 'ramda'

import {
  handleActions,
  handleResult,
  handleTransitions,
  combine,
  unset,
  noop,
} from 'utils/reduxTools'

import { actions } from './constants'

export default handleTransitions((state) => state.state, {
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
        user: (p) => p.user,
        tokens: (p) => p.tokens,
        sessionId: () => R.inc,
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
      sessionId: () => R.inc,
    }),
    [actions.REFRESH]: combine({
      state: 'REFRESHING',
      error: unset,
    }),
    [actions.AUTH_LOST]: combine({
      state: 'SIGNED_OUT',
      error: R.identity,
      tokens: unset,
      user: unset,
      sessionId: () => R.inc,
    }),
  }),
  REFRESHING: handleActions({
    [actions.REFRESH_RESULT]: handleResult({
      resolve: combine({
        state: 'SIGNED_IN',
        tokens: ({ tokens }) => tokens,
        user: ({ user }) => (user ? user : noop),
      }),
      reject: combine({
        state: 'SIGNED_OUT',
        error: R.identity,
        tokens: unset,
        user: unset,
        sessionId: () => R.inc,
      }),
    }),
  }),
})
