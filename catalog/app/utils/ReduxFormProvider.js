import { reducer } from 'redux-form/es/immutable'

import * as ReducerInjector from 'utils/ReducerInjector'

export default function ReduxFormProvider({ children }) {
  ReducerInjector.useReducer('form', reducer)
  return children
}
