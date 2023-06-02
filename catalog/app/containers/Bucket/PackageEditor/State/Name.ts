import * as React from 'react'

import { L } from 'components/Form/Package/types'

import { useNameExistence, useNameValidator } from '../../PackageDialog/PackageDialog'

import type { BucketContext } from './Bucket'
import type { Src } from './Source'
import type { WorkflowContext } from './Workflow'
import NOT_READY from './errorNotReady'

export interface NameState {
  errors?: Error[] | typeof L
  value: string
  warnings?: string[] | typeof L
}

export interface NameFormData {
  value: string
}

export interface NameContext {
  state: NameState | typeof L
  getters: {
    formData: () => string
    disabled: () => boolean
  }
  actions: {
    onChange: (v: string) => void
  }
}

export function getFormData(state: NameState | typeof L) {
  if (state === L) {
    throw NOT_READY
  }
  return state.value
}

function isDisabled(state: NameState | typeof L) {
  if (state === L) return true
  if (state.errors === L || state.errors?.length || state.warnings === L) {
    return true
  }
  return false
}

function useValidation(value: string, bucket: BucketContext, workflow: WorkflowContext) {
  const [errors, setErrors] = React.useState<Error[] | typeof L | undefined>()
  const [warnings, setWarnings] = React.useState<string[] | typeof L | undefined>()

  const valueTracker = React.useRef(value)
  const nameExistence = useNameExistence(bucket.state.value?.name || '')
  const selectedWorkflow = React.useMemo(
    () => (workflow.state !== L ? workflow.state.value : null),
    [workflow.state],
  )
  const nameValidator = useNameValidator(selectedWorkflow || undefined)

  const validate = React.useCallback(
    async (name: string): Promise<Error | undefined> => {
      const error = await nameValidator.validate(name)
      if (!error) return

      switch (error) {
        case 'invalid':
          return new Error(`Invalid package name`)
        case 'pattern':
          return new Error(`Name should match ${selectedWorkflow?.packageNamePattern}`)
        default:
          return new Error(error)
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [nameValidator.validate, selectedWorkflow],
  )

  React.useEffect(() => {
    async function onValueChange() {
      valueTracker.current = value
      setErrors(undefined)

      if (!value) {
        setWarnings(undefined)
        setErrors([new Error('Enter a package name')])
        return
      }

      setWarnings(L)
      setErrors(L)
      const [nameExists, error] = await Promise.all([
        nameExistence.validate(value),
        validate(value),
      ])
      if (valueTracker.current !== value) return
      setErrors(error ? [error] : undefined)
      setWarnings(error ? undefined : [nameExists ? 'Existing package' : 'New package'])
    }
    onValueChange()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nameExistence.validate, validate, value])

  return { errors, warnings }
}

export default function useName(
  src: Src,
  bucket: BucketContext,
  workflow: WorkflowContext,
): NameContext {
  const [value, setValue] = React.useState(src.packageHandle?.name || '')

  const { errors, warnings } = useValidation(value, bucket, workflow)

  const state = React.useMemo(
    () => (workflow.state === L ? L : ({ errors, value, warnings } as NameState)),
    [errors, value, warnings, workflow.state],
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
