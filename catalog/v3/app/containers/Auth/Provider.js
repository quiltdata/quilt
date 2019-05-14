import { fromJS } from 'immutable'
import PT from 'prop-types'
import * as React from 'react'
import * as RC from 'recompose'
import { useDispatch } from 'redux-react-hook'

import { push as notify } from 'containers/Notifications/actions'
import { useIntl } from 'containers/LanguageProvider'
import { useReducer } from 'utils/ReducerInjector'
import { useSaga } from 'utils/SagaInjector'
import * as RT from 'utils/reactTools'
import { withInitialState } from 'utils/reduxTools'

import { REDUX_KEY } from './constants'
import msg from './messages'
import reducer from './reducer'
import saga from './saga'

const ActionPattern = PT.oneOfType([PT.string, PT.func])

const StorageShape = PT.shape({
  set: PT.func.isRequired,
  remove: PT.func.isRequired,
  load: PT.func.isRequired,
})

const useStorageHandlers = (storage) =>
  React.useMemo(
    () => ({
      storeTokens: (tokens) => storage.set('tokens', tokens),
      forgetTokens: () => storage.remove('tokens'),
      storeUser: (user) => storage.set('user', user),
      forgetUser: () => storage.remove('user'),
      storeCredentials: (credentials) => storage.set('credentials', credentials),
      forgetCredentials: () => storage.remove('credentials'),
    }),
    [storage],
  )

const useNotificationHandlers = () => {
  const intl = useIntl()
  const dispatch = useDispatch()
  return React.useMemo(
    () => ({
      onAuthLost: () => {
        dispatch(notify(intl.formatMessage(msg.notificationAuthLost)))
      },
      onAuthError: () => {
        dispatch(notify(intl.formatMessage(msg.notificationAuthError)))
      },
    }),
    [intl, dispatch],
  )
}

/**
 * Provider component for the authentication system.
 */
export default RT.composeComponent(
  'Auth.Provider',
  RC.setPropTypes({
    /**
     * Determines on which actions to fire the check logic.
     */
    checkOn: PT.oneOfType([ActionPattern, PT.arrayOf(ActionPattern)]),
    /**
     * Storage instance used to persist tokens and user data.
     */
    storage: StorageShape.isRequired,
    /**
     * Expected API latency in seconds.
     */
    latency: PT.number,
  }),
  ({ children, checkOn, storage, latency = 20 }) => {
    const reducerWithInit = React.useMemo(() => {
      const init = fromJS(storage.load())
        .filter(Boolean)
        .update((s) =>
          s.set('state', s.getIn(['user', 'current_user']) ? 'SIGNED_IN' : 'SIGNED_OUT'),
        )
      return withInitialState(init, reducer)
    }, [])
    useReducer(REDUX_KEY, reducerWithInit)

    const handlers = {
      ...useStorageHandlers(storage),
      ...useNotificationHandlers(),
    }
    useSaga(saga, { ...handlers, checkOn, latency })

    return children
  },
)
