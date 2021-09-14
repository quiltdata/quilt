import { createSelector } from 'reselect'

import { REDUX_KEY } from './constants'

export default createSelector(
  (state) => state.get(REDUX_KEY, []),
  (notifications) => ({ notifications }),
)
