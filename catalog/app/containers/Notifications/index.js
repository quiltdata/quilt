import PT from 'prop-types'
import * as React from 'react'
import { connect } from 'react-redux'
import { defaultProps, setPropTypes, withProps } from 'recompose'
import { bindActionCreators } from 'redux'
import * as reduxHook from 'redux-react-hook'

import { composeComponent } from 'utils/reactTools'
import * as ReducerInjector from 'utils/ReducerInjector'

import * as actions from './actions'
import { REDUX_KEY } from './constants'
import reducer from './reducer'
import selector from './selectors'
import Notification from './Notification'

export const Provider = composeComponent(
  'Notifications.Provider',
  withProps({ mount: REDUX_KEY, reducer }),
  ReducerInjector.Inject,
)

export const Display = composeComponent(
  'Notifications.Display',
  connect(
    selector,
    actions,
  ),
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

export const WithNotifications = composeComponent(
  'Notifications.WithNotifications',
  ({ children }) => (
    <React.Fragment>
      {children}
      <Display />
    </React.Fragment>
  ),
)

export const useNotifications = () => {
  const dispatch = reduxHook.useDispatch()
  return React.useMemo(() => bindActionCreators(actions, dispatch), [dispatch])
}

export const use = useNotifications
