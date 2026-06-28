import { fromJS } from 'immutable'

import { Action, Reducer } from 'utils/reduxTools'

import { PUSH, DISMISS } from './constants'

const initialState = fromJS([])

// eslint-disable-next-line @typescript-eslint/default-param-last
const reducer: Reducer = (state = initialState, action: Action) => {
  switch (action.type) {
    case PUSH:
      return state.push(fromJS(action.notification))
    case DISMISS:
      return state.filter((n: any) => n.get('id') !== action.id)
    default:
      return state
  }
}

export default reducer
