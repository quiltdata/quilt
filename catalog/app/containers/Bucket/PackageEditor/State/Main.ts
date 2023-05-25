import * as React from 'react'

import { L } from 'components/Form/Package/types'

export interface MainContext {
  state: boolean | Error[] | typeof L
  actions: {
    onSubmit: () => void
  }
}

export default function useMain(): MainContext {
  const [submitted, setSubmitted] = React.useState(false)
  return React.useMemo(
    () => ({
      state: submitted,
      actions: {
        onSubmit: () => setSubmitted(true),
      },
    }),
    [submitted],
  )
}
