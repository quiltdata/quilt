import type * as H from 'history'
import * as React from 'react'
import * as RRDom from 'react-router-dom'

import type { ActionPreferences } from 'utils/BucketPreferences'

// TODO: Use ?query=stirngs as a source of truth for opening package dialogs

const Actions: Partial<ActionPreferences> = {
  copyPackage: true,
  createPackage: true,
  revisePackage: true,
}

type Action = keyof typeof Actions

function clearActions(searchParams: URLSearchParams, history: H.History) {
  searchParams.delete('action')
  history.replace({
    search: searchParams.toString(),
  })
}

function isActions(actions: string[]): actions is Action[] {
  return actions.every((a) => !!Actions[a as Action])
}

export default function useInitialActions(): Action[] {
  const history = RRDom.useHistory()
  const location = RRDom.useLocation()

  const searchParams = React.useMemo(
    () => new URLSearchParams(location.search),
    [location.search],
  )
  const actions = searchParams.getAll('action')
  const initialActions = React.useRef<Action[]>(isActions(actions) ? actions : [])

  React.useEffect(() => {
    if (searchParams.has('action')) clearActions(searchParams, history)
  }, [history, searchParams])

  return initialActions.current
}
