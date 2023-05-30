import * as React from 'react'

import { L } from 'components/Form/Package/types'

import { useNameExistence, useNameValidator } from '../../PackageDialog/PackageDialog'

import type { BucketContext } from './Bucket'
import type { Src } from './Source'
import type { WorkflowContext } from './Workflow'

interface NameState {
  errors?: Error[] | typeof L
  value: string
  warnings?: string[] | typeof L
}

export interface NameContext {
  state: NameState | typeof L
  actions: {
    onChange: (v: string) => void
  }
}

export default function useName(
  src: Src,
  bucket: BucketContext,
  workflow: WorkflowContext,
): NameContext {
  const [value, setValue] = React.useState(src.packageHandle?.name || '')
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
    [nameValidator, selectedWorkflow],
  )

  const handleChange = React.useCallback(
    async (v: string) => {
      valueTracker.current = v
      setValue(v)
      setErrors(undefined)

      if (!v) {
        setWarnings(undefined)
        setErrors([new Error('Enter a package name')])
        return
      }

      setWarnings(L)
      setErrors(L)
      const [nameExists, error] = await Promise.all([
        nameExistence.validate(v),
        validate(v),
      ])
      if (valueTracker.current !== v) return
      setErrors(error ? [error] : undefined)
      setWarnings(error ? undefined : [nameExists ? 'Existing package' : 'New package'])
    },
    [nameExistence, validate],
  )

  const state = React.useMemo(
    () => (workflow.state === L ? L : ({ errors, value, warnings } as NameState)),
    [errors, value, warnings, workflow.state],
  )

  return React.useMemo(
    () => ({
      state,
      actions: {
        onChange: handleChange,
      },
    }),
    [handleChange, state],
  )
}
