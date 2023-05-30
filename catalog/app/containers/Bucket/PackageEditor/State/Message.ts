import * as React from 'react'

interface MessageState {
  errors?: Error[]
  value: string
}

export interface MessageContext {
  state: MessageState
  actions: {
    onChange: (v: string) => void
  }
}

export default function useMessage(): MessageContext {
  const [value, setValue] = React.useState('')
  const [errors, setErrors] = React.useState<Error[] | undefined>()
  const handleChange = React.useCallback((message: string) => {
    setValue(message)
    setErrors(undefined)
    if (!message) {
      setErrors([new Error('Enter a commit message')])
    }
  }, [])
  return React.useMemo(
    () => ({
      state: {
        errors,
        value,
      },
      actions: {
        onChange: handleChange,
      },
    }),
    [handleChange, errors, value],
  )
}
