import * as React from 'react'

import type { PackageHandle } from 'utils/packageHandle'

import type { FilesState } from '../Inputs/Files/State'

export type FormStatus =
  | { _tag: 'idle' }
  | { _tag: 'ready' }
  | { _tag: 'submitting' }
  | { _tag: 'emptyFiles' }
  | {
      _tag: 'error'
      error: Error
      fields?: {
        files?: Error

        message?: Error
        name?: Error
        userMeta?: Error
        workflow?: Error
      }
    }
  | { _tag: 'success'; handle: PackageHandle }

export const Idle = { _tag: 'idle' as const }
export const Ready = { _tag: 'ready' as const }
export const Submitting = { _tag: 'submitting' as const }
export const EmptyFiles = { _tag: 'emptyFiles' as const }
export const Err = (
  error: Error,
  fields?: {
    files?: Error
    message?: Error
    name?: Error
    userMeta?: Error
    workflow?: Error
  },
) => ({ _tag: 'error' as const, error, fields })
export const Success = (handle: PackageHandle) => ({ _tag: 'success' as const, handle })

export interface FormState {
  formStatus: FormStatus
  setFormStatus: React.Dispatch<React.SetStateAction<FormStatus>>
}

export function useFormStatus(initialOpen: boolean | FilesState['added']): FormState {
  const [formStatus, setFormStatus] = React.useState<FormStatus>(() => {
    if (!window.crypto?.subtle?.digest) {
      return {
        _tag: 'error',
        error: new Error(
          'Quilt requires the Web Cryptography API. Please try another browser.',
        ),
      }
    }
    if (initialOpen) return { _tag: 'ready' }
    return { _tag: 'idle' }
  })

  return {
    formStatus,
    setFormStatus,
  }
}
