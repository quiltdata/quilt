import * as React from 'react'

export interface MessageState {
  errors?: Error[]
  value: string
}

export interface MessageContext {
  state: MessageState
  getters: {
    formData: () => string
    disabled: () => boolean
  }
  actions: {
    onChange: (v: string) => void
  }
}

export function getFormData(state: MessageState) {
  return state.value
}

export function isDisabled(state: MessageState) {
  return !!state.errors?.length
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

  const state = React.useMemo(
    () => ({
      errors,
      value,
    }),
    [errors, value],
  )

  return React.useMemo(
    () => ({
      state,
      getters: {
        formData: () => getFormData(state),
        disabled: () => isDisabled(state),
      },
      actions: {
        onChange: setValue,
      },
    }),
    [state],
  )
}
