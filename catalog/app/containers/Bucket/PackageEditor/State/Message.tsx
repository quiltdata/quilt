import * as React from 'react'

import { L } from 'components/Form/Package/types'

interface MessageState {
  errors?: Error[] | typeof L
  value: string
}

export interface MessageContext {
  state: MessageState | typeof L
  actions: {
    onChange: (v: string) => void
  }
}

export default function useMessage(): MessageContext {
  const [value, setValue] = React.useState('')
  return React.useMemo(
    () => ({
      state: {
        value,
      },
      actions: {
        onChange: setValue,
      },
    }),
    [value],
  )
}
