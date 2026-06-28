import * as React from 'react'
import * as redux from 'react-redux'
import { bindActionCreators } from 'redux'

import * as ReducerInjector from 'utils/ReducerInjector'

import * as actions from './actions'
import { REDUX_KEY } from './constants'
import reducer from './reducer'
import selector from './selectors'
import Notification from './Notification'

interface ProviderProps {
  children: React.ReactNode
}

export const Provider = function NotificationsProvider({ children }: ProviderProps) {
  ReducerInjector.useReducer(REDUX_KEY, reducer)
  return children
}

export function Display() {
  const { notifications } = redux.useSelector(selector)
  const dispatch = redux.useDispatch()
  const handleDismiss = React.useCallback(
    (id: string) => dispatch(actions.dismiss(id)),
    [dispatch],
  )
  return (
    <>
      {notifications.map((n) => (
        <Notification key={n.id} {...n} dismiss={handleDismiss} />
      ))}
    </>
  )
}

export function WithNotifications({ children }: ProviderProps) {
  return (
    <>
      {children}
      <Display />
    </>
  )
}

export const useNotifications = () => {
  const dispatch = redux.useDispatch()
  return React.useMemo(() => bindActionCreators(actions, dispatch), [dispatch])
}

export { useNotifications as use }
