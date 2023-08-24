import * as React from 'react'
import * as RRDom from 'react-router-dom'

import type { ActionPreferences } from 'utils/BucketPreferences'

const Actions: Partial<ActionPreferences> = {
  revisePackage: true,
}

type Action = keyof typeof Actions

function clearActions(searchParams: URLSearchParams, navigate: RRDom.NavigateFunction) {
  searchParams.delete('action')
  navigate({
    search: searchParams.toString(),
  })
}

function isActions(actions: string[]): actions is Action[] {
  return actions.every((a) => !!Actions[a as Action])
}

export default function useInitialActions(): Action[] {
  const navigate = RRDom.useNavigate()
  const location = RRDom.useLocation()

  const searchParams = React.useMemo(
    () => new URLSearchParams(location.search),
    [location.search],
  )
  const actions = searchParams.getAll('action')
  const initialActions = React.useRef<Action[]>(isActions(actions) ? actions : [])

  React.useEffect(() => {
    if (searchParams.has('action')) clearActions(searchParams, navigate)
  }, [navigate, searchParams])

  return initialActions.current
}
