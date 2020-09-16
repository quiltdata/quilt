import { reducer, reduxForm } from 'redux-form/es/immutable'

import * as ReducerInjector from 'utils/ReducerInjector'

export * from 'redux-form/es/immutable'

export const Provider = function ReduxFormProvider({ children }) {
  ReducerInjector.useReducer('form', reducer)
  return children
}

export const ReduxForm = reduxForm()(({ children, ...props }) => children(props))
