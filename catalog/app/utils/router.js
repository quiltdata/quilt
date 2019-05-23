import {
  ConnectedRouter,
  connectRouter,
  LOCATION_CHANGE,
} from 'connected-react-router/immutable'
import { matchPath } from 'react-router-dom'
import * as reduxHook from 'redux-react-hook'

import { composeComponent } from 'utils/reactTools'
import { injectReducerFactory } from 'utils/ReducerInjector'

export { LOCATION_CHANGE }

export const REDUX_KEY = 'router'

export const selectLocation = (s) => s.getIn([REDUX_KEY, 'location']).toJS()

export const useLocation = () => reduxHook.useMappedState(selectLocation)

export const useRoute = (path, opts) => {
  const location = useLocation()
  const match = matchPath(location.pathname, { path, ...opts })
  return { location, match }
}

export default composeComponent(
  'RouterProvider',
  injectReducerFactory(REDUX_KEY, ({ history }) => connectRouter(history)),
  ConnectedRouter,
)
