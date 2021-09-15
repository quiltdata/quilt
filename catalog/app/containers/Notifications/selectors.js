import { createSelector } from 'reselect'

import { REDUX_KEY } from './constants'

export default createSelector(
  (state) => state[REDUX_KEY] || [],
  (notifications) => ({ notifications }),
)
