import * as React from 'react'

export interface MessageState {
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
  React.useEffect(() => {
    setErrors(undefined)
    if (!value) {
      setErrors([new Error('Enter a commit message')])
    }
  }, [value])

  return React.useMemo(
    () => ({
      state: {
        errors,
        value,
      },
      actions: {
        onChange: setValue,
      },
    }),
    [errors, value],
  )
}
