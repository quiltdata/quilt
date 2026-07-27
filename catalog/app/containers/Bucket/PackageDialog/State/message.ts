import * as React from 'react'

import type { FormStatus } from './form'

type MessageStatus = { _tag: 'error'; error: Error } | { _tag: 'ok' }

export interface MessageState {
  value: string | undefined
  status: MessageStatus
  onChange: (m: string) => void
}

export function useMessage(form: FormStatus): MessageState {
  const [message, setMessage] = React.useState<string>()
  const status: MessageStatus = React.useMemo(() => {
    if (form._tag !== 'error') return { _tag: 'ok' }
    if (form.fields?.message) return { _tag: 'error', error: form.fields.message }
    if (!message) return { _tag: 'error', error: new Error('Enter a commit message') }
    return { _tag: 'ok' }
  }, [message, form])
  return React.useMemo(
    () => ({ value: message, status, onChange: setMessage }),
    [message, status],
  )
}
