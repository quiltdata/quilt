import * as R from 'ramda'

import { PUSH, DISMISS } from './constants'

const initialState = []

export default (state = initialState, action) => {
  switch (action.type) {
    case PUSH:
      return R.append(action.notification, state)
    case DISMISS:
      return R.filter((n) => n.id !== action.id, state)
    default:
      return state
  }
}
