import * as React from 'react'

import type { PackageHandle } from 'utils/packageHandle'

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

function setter(open: boolean) {
  if (!window.crypto?.subtle?.digest) {
    return Err(
      new Error('Quilt requires the Web Cryptography API. Please try another browser.'),
    )
  }
  return open ? Ready : Idle
}

export function useFormStatus(open: boolean): FormState {
  const [formStatus, setFormStatus] = React.useState<FormStatus>(() => setter(open))

  React.useEffect(() => setFormStatus(setter(open)), [open])

  return {
    formStatus,
    setFormStatus,
  }
}

export { useFormStatus as use }
