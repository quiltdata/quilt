import * as R from 'ramda'
import * as React from 'react'
import * as redux from 'react-redux'

import { push as notify } from 'containers/Notifications/actions'
import { useReducer } from 'utils/ReducerInjector'
import { useSaga } from 'utils/SagaInjector'
import { withInitialState } from 'utils/reduxTools'
import useConstant from 'utils/useConstant'

import { REDUX_KEY } from './constants'
import reducer from './reducer'
import saga from './saga'

/*
const ActionPattern = PT.oneOfType([PT.string, PT.func])

const StorageShape = PT.shape({
  set: PT.func.isRequired,
  remove: PT.func.isRequired,
  load: PT.func.isRequired,
})
*/

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
  const dispatch = redux.useDispatch()
  return React.useMemo(
    () => ({
      onAuthLost: () => {
        dispatch(notify('Authentication lost. Sign in again.'))
      },
    }),
    [dispatch],
  )
}

/**
 * Provider component for the authentication system.
 */
export default function AuthProvider({
  children,
  /**
   * Determines on which actions to fire the check logic.
   */
  checkOn, // oneOfType([ActionPattern, PT.arrayOf(ActionPattern)])
  /**
   * Storage instance used to persist tokens and user data.
   */
  storage, // StorageShape.isRequired
  /**
   * Expected API latency in seconds.
   */
  latency = 20, // number
}) {
  const reducerWithInit = useConstant(() => {
    const loadedState = R.filter(Boolean, storage.load())
    const signed = R.assoc(
      'state',
      R.path(['user', 'current_user'], loadedState) ? 'SIGNED_IN' : 'SIGNED_OUT',
      loadedState,
    )
    const init = R.assoc('sessionId', 0, signed)
    return withInitialState(init, reducer)
  })
  useReducer(REDUX_KEY, reducerWithInit)

  const handlers = {
    ...useStorageHandlers(storage),
    ...useNotificationHandlers(),
  }
  useSaga(saga, { ...handlers, checkOn, latency })

  return children
}
