import { fromJS } from 'immutable'
import { createSelector } from 'reselect'

import { REDUX_KEY } from './constants'

export default createSelector(
  (state) => state.get(REDUX_KEY, fromJS([])),
  (ns) => ({ notifications: ns.toJS() }),
)
