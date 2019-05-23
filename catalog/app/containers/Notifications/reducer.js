import { fromJS } from 'immutable'

import { PUSH, DISMISS } from './constants'

const initialState = fromJS([])

export default (state = initialState, action) => {
  switch (action.type) {
    case PUSH:
      return state.push(fromJS(action.notification))
    case DISMISS:
      return state.filter((n) => n.get('id') !== action.id)
    default:
      return state
  }
}
