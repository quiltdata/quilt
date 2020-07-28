import PT from 'prop-types'
import * as React from 'react'
import * as redux from 'react-redux'
import { defaultProps, setPropTypes } from 'recompose'
import { bindActionCreators } from 'redux'

import { composeComponent } from 'utils/reactTools'
import * as ReducerInjector from 'utils/ReducerInjector'

import * as actions from './actions'
import { REDUX_KEY } from './constants'
import reducer from './reducer'
import selector from './selectors'
import Notification from './Notification'

export const Provider = function NotificationsProvider({ children }) {
  ReducerInjector.useReducer(REDUX_KEY, reducer)
  return children
}

export const Display = composeComponent(
  'Notifications.Display',
  redux.connect(selector, actions),
  setPropTypes({
    notifications: PT.arrayOf(
      PT.shape({
        id: PT.string.isRequired,
        ttl: PT.number.isRequired,
        message: PT.node.isRequired,
        action: PT.shape({
          label: PT.string.isRequired,
          onClick: PT.func.isRequired,
        }),
      }).isRequired,
    ).isRequired, // eslint-disable-line function-paren-newline
    dismiss: PT.func.isRequired,
    NotificationComponent: PT.oneOfType([PT.string, PT.func]),
  }),
  defaultProps({ NotificationComponent: Notification }),
  ({ NotificationComponent, notifications, dismiss }) =>
    notifications.map((n) => (
      <NotificationComponent key={n.id} {...n} dismiss={dismiss} />
    )),
)

export function WithNotifications({ children }) {
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
