import { Map } from 'immutable'
import * as R from 'ramda'
import { createSelector } from 'reselect'

import { get, getIn, toJS } from 'utils/immutableTools'

import { REDUX_KEY, waitingStates } from './constants'

export const domain = createSelector(get(REDUX_KEY, Map({})), toJS())

export const state = createSelector(getIn([REDUX_KEY, 'state']), R.identity)

export const waiting = createSelector(state, (s) => waitingStates.includes(s))

export const error = createSelector(getIn([REDUX_KEY, 'error']), R.identity)

export const username = createSelector(
  getIn([REDUX_KEY, 'user', 'current_user']),
  R.identity,
)

export const authenticated = createSelector(username, Boolean)

export const isAdmin = createSelector(getIn([REDUX_KEY, 'user', 'is_staff']), R.identity)

export const email = createSelector(getIn([REDUX_KEY, 'user', 'email']), R.identity)

export const tokens = createSelector(getIn([REDUX_KEY, 'tokens']), toJS())

export const sessionId = createSelector(getIn([REDUX_KEY, 'sessionId']), R.identity)
