import * as React from 'react'

import * as GQL from 'utils/GraphQL'

import SUBSCRIPTION_QUERY from './gql/Subscription.generated'

interface SubscriptionState {
  invalid: boolean
  dismissed: boolean
  dismiss: () => void
  restore: () => void
}

export function useState(): SubscriptionState {
  const data = GQL.useQuery(SUBSCRIPTION_QUERY)

  const invalid = GQL.fold(data, {
    fetching: () => false,
    error: () => false,
    data: (d) => !d.subscription.active,
  })

  const [dismissed, setDismissedState] = React.useState(
    () => window.sessionStorage.getItem('quilt-license-error-dismissed') === 'true',
  )

  const setDismissed = React.useCallback(
    (value: boolean) => {
      window.sessionStorage.setItem(
        'quilt-license-error-dismissed',
        JSON.stringify(value),
      )
      setDismissedState(value)
    },
    [setDismissedState],
  )

  const dismiss = React.useCallback(() => {
    setDismissed(true)
  }, [setDismissed])

  const restore = React.useCallback(() => {
    setDismissed(false)
  }, [setDismissed])

  return {
    invalid,
    dismissed,
    dismiss,
    restore,
  }
}
