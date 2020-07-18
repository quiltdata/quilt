import {
  ConnectedRouter,
  connectRouter,
  LOCATION_CHANGE,
} from 'connected-react-router/esm/immutable'
import * as React from 'react'
import { matchPath } from 'react-router-dom'
import * as redux from 'react-redux'

import * as ReducerInjector from 'utils/ReducerInjector'

export { LOCATION_CHANGE }

export const REDUX_KEY = 'router'

export const selectLocation = (s) => s.getIn([REDUX_KEY, 'location']).toJS()

export const useLocation = () => redux.useSelector(selectLocation)

export const useRoute = (path, opts) => {
  const location = useLocation()
  const match = matchPath(location.pathname, { path, ...opts })
  return { location, match }
}

export default function RouterProvider(props) {
  const reducer = React.useMemo(() => connectRouter(props.history), [props.history])
  ReducerInjector.useReducer(REDUX_KEY, reducer)
  return <ConnectedRouter {...props} />
}
