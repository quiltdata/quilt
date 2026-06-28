import { fromJS } from 'immutable'
import * as React from 'react'
import * as redux from 'react-redux'

import { push as notify } from 'containers/Notifications/actions'
import { useReducer } from 'utils/ReducerInjector'
import { useSaga } from 'utils/SagaInjector'
import { withInitialState } from 'utils/reduxTools'
import useConstant from 'utils/useConstant'

import * as actions from './actions'
import { REDUX_KEY } from './constants'
import reducer from './reducer'
import saga from './saga'
import * as selectors from './selectors'

/*
const ActionPattern = PT.oneOfType([PT.string, PT.func])

const StorageShape = PT.shape({
  set: PT.func.isRequired,
  remove: PT.func.isRequired,
  load: PT.func.isRequired,
})
*/

// Subset of the storage abstraction (utils/storage) that the Provider actually
// uses. Kept loose to accommodate the minimal stub passed in by the embed app.
interface Storage {
  set: (key: string, value: unknown) => void
  remove: (key: string) => void
  load: () => unknown
}

const useStorageHandlers = (storage: Storage) =>
  React.useMemo(
    () => ({
      storeTokens: (tokens: unknown) => storage.set('tokens', tokens),
      forgetTokens: () => storage.remove('tokens'),
      storeUser: (user: unknown) => storage.set('user', user),
      forgetUser: () => storage.remove('user'),
      storeCredentials: (credentials: unknown) => storage.set('credentials', credentials),
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

function useCheck() {
  const dispatch = redux.useDispatch()
  const exp = redux.useSelector(selectors.exp)
  React.useEffect(() => {
    if (typeof exp !== 'number') return
    const ts = Date.now()
    const timeLeft = exp * 1000 - ts
    const timer = setTimeout(() => dispatch(actions.check()), timeLeft)
    return () => clearTimeout(timer)
  }, [dispatch, exp])
}

interface AuthProviderProps {
  children: React.ReactNode
  /** Storage instance used to persist tokens and user data. */
  storage: Storage
  /** Expected API latency in seconds. */
  latency?: number
}

/**
 * Provider component for the authentication system.
 */
export default function AuthProvider({
  children,
  storage,
  latency = 20,
}: AuthProviderProps) {
  const reducerWithInit = useConstant(() => {
    const init = fromJS(storage.load())
      .filter(Boolean)
      .update((s: any) =>
        s
          .set('state', s.getIn(['user', 'current_user']) ? 'SIGNED_IN' : 'SIGNED_OUT')
          .set('sessionId', 0),
      )
    return withInitialState(init, reducer)
  })
  useReducer(REDUX_KEY, reducerWithInit)

  const handlers = {
    ...useStorageHandlers(storage),
    ...useNotificationHandlers(),
  }
  useSaga(saga, { ...handlers, latency })

  useCheck()

  return children
}
