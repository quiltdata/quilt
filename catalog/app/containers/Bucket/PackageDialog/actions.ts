import type * as H from 'history'
import * as React from 'react'
import * as RRDom from 'react-router-dom'

import type { ActionPreferences } from 'utils/BucketPreferences'

const Actions: Partial<ActionPreferences> = {
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
  const unsupportedActions = actions.filter((a) => !Actions[a as Action])
  return !unsupportedActions.length
}

export default function useInitialActions(): Action[] {
  const location = RRDom.useLocation()
  const history = RRDom.useHistory()
  const [initialActions, setInitialActions] = React.useState<Action[]>([])

  React.useEffect(() => {
    const searchParams = new URLSearchParams(location.search)
    if (!searchParams.has('action')) return

    const actions = searchParams.getAll('action')
    if (isActions(actions)) {
      setInitialActions(actions)
    }

    clearActions(searchParams, history)
  }, [history, location.search])

  return initialActions
}
