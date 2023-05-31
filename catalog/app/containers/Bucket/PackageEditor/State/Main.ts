import * as React from 'react'

import { L } from 'components/Form/Package/types'

interface MainState {
  submitted: boolean
  succeed: boolean
}

export interface MainContext {
  state: MainState | typeof L
  actions: {
    onSubmit: () => void
  }
}

export default function useMain(): MainContext {
  const [submitted, setSubmitted] = React.useState(false)
  const [succeed] = React.useState(false)
  const onSubmit = React.useCallback(() => {
    setSubmitted(true)
  }, [])
  return React.useMemo(
    () => ({
      state: {
        submitted,
        succeed,
      },
      actions: {
        onSubmit,
      },
    }),
    [submitted, succeed, onSubmit],
  )
}
