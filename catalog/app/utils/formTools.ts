import { FORM_ERROR } from 'final-form'
import * as React from 'react'

export const mkFormError = (err: React.ReactNode) => ({ [FORM_ERROR]: err })

export interface InputError {
  path: string | null
  message: string
}

export function mapInputErrors(
  inputErrors: Readonly<InputError[]>,
  mapping: Record<string, string> = {},
) {
  const formErrors: Record<string, string> = {}
  for (let err of inputErrors) {
    const key = err.path && err.path in mapping ? mapping[err.path] : FORM_ERROR
    formErrors[key] = err.message
  }
  return formErrors
}
