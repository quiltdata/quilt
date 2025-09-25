import * as React from 'react'

import type { PackageHandle } from 'utils/packageHandle'

import type { FilesState } from '../FilesState'

export type FormStatus =
  | { _tag: 'idle' }
  | { _tag: 'ready' }
  | { _tag: 'submitting' }
  | { _tag: 'emptyFiles' }
  | {
      _tag: 'submitFailed'
      error: Error
      fields?: {
        workflow?: Error
        meta?: Error
        files?: Error
        message?: Error
        name?: Error
      }
    }
  | { _tag: 'success'; handle: PackageHandle }

export interface FormState {
  formStatus: FormStatus
  setFormStatus: React.Dispatch<React.SetStateAction<FormStatus>>
}

export function useFormStatus(initialOpen: boolean | FilesState['added']): FormState {
  const [formStatus, setFormStatus] = React.useState<FormStatus>(
    initialOpen ? { _tag: 'ready' } : { _tag: 'idle' },
  )

  return {
    formStatus,
    setFormStatus,
  }
}
