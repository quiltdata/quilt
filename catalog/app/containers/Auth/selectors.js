import * as R from 'ramda'
import { createSelector } from 'reselect'

import { REDUX_KEY, waitingStates } from './constants'

export const domain = createSelector((s) => s[REDUX_KEY] || {}, R.identity)

export const state = createSelector((s) => s[REDUX_KEY]?.state, R.identity)

export const waiting = createSelector(state, (s) => waitingStates.includes(s))

export const error = createSelector((s) => s[REDUX_KEY]?.error, R.identity)

export const username = createSelector(
  (s) => s[REDUX_KEY]?.user?.current_user,
  R.identity,
)

export const authenticated = createSelector(username, Boolean)

export const isAdmin = createSelector((s) => s[REDUX_KEY]?.user?.is_staff, R.identity)

export const email = createSelector((s) => s[REDUX_KEY]?.user?.email, R.identity)

export const tokens = createSelector((s) => s[REDUX_KEY]?.tokens, R.identity)

export const sessionId = createSelector((s) => s[REDUX_KEY]?.sessionId, R.identity)
