import { fromJS } from 'immutable'
import * as React from 'react'
import { createSelector } from 'reselect'

import { REDUX_KEY } from './constants'

interface Notification {
  id: string
  ttl: number | null
  message: React.ReactNode
  action?: {
    onClick: () => void
    label: React.ReactNode
  }
}

// The global redux state is untyped Immutable.js; expose only the `.get` we use.
interface State {
  get: (key: string, defaultValue: unknown) => { toJS: () => Notification[] }
}

export default createSelector(
  (state: State) => state.get(REDUX_KEY, fromJS([])),
  (ns) => ({ notifications: ns.toJS() }),
)
