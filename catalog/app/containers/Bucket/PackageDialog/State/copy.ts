import * as React from 'react'

import Log from 'utils/Logging'
import assertNever from 'utils/assertNever'
import { useMutation } from 'utils/GraphQL'

import PACKAGE_PROMOTE from '../gql/PackagePromote.generated'

import { Err, FormFieldErrors, FormStatus, Submitting, Success } from './form'
import { FormParams } from './params'
import { PackageSrc } from './manifest'

interface InputError {
  readonly path: string | null
  readonly message: string
}

/**
 * Map a server-side validation rejection onto the form: errors we can attribute
 * to a specific input are attached to that input, the rest become the
 * form-level message.
 */
function invalidInput(errors: ReadonlyArray<InputError>): FormStatus {
  const fields: FormFieldErrors = {}
  let error = new Error('Something went wrong')
  for (const err of errors) {
    switch (err.path) {
      case 'params.name':
        fields.name = new Error(err.message)
        break
      case 'params.message':
        fields.message = new Error(err.message)
        break
      case 'params.userMeta':
        fields.userMeta = new Error(err.message)
        break
      case 'params.workflow':
        fields.workflow = new Error(err.message)
        break
      default:
        error = new Error(err.message)
    }
  }
  return Err(error, fields)
}

function useCopy() {
  const promotePackage = useMutation(PACKAGE_PROMOTE)

  return React.useCallback(
    async (
      formParams: FormParams,
      src: Required<PackageSrc>,
      destPrefix: string | null,
    ): Promise<FormStatus> => {
      if (formParams._tag === 'invalid') return Err(formParams.error)

      const { params } = formParams

      // Only the request itself is guarded: an exception here is an unexpected
      // runtime failure, while a rejected write comes back as a typed response
      // below. Collapsing the two loses the per-field errors.
      let r
      try {
        const { packagePromote } = await promotePackage({ params, src, destPrefix })
        r = packagePromote
      } catch (e) {
        Log.error('Error copying package:')
        Log.error(e)
        return Err(
          new Error(
            e instanceof Error
              ? `Unexpected error: ${e.message}`
              : 'Error copying package',
          ),
        )
      }

      switch (r.__typename) {
        case 'PackagePushSuccess':
          return Success({
            bucket: params.bucket,
            name: params.name,
            hash: r.revision.hash,
          })
        case 'OperationError':
          return Err(new Error(r.message))
        case 'InvalidInput':
          return invalidInput(r.errors)
        default:
          assertNever(r)
      }
    },
    [promotePackage],
  )
}

export type CopyHandler = (
  src: Required<PackageSrc>,
  destPrefix: string | null,
) => Promise<void>

export function useCopyHandler(
  params: FormParams,
  setFormStatus: React.Dispatch<React.SetStateAction<FormStatus>>,
): CopyHandler {
  const copyPackage = useCopy()

  return React.useCallback(
    async (src: Required<PackageSrc>, destPrefix: string | null) => {
      setFormStatus(Submitting)
      try {
        setFormStatus(await copyPackage(params, src, destPrefix))
      } catch (e) {
        // Safety net: expected failures are returned as `FormStatus`, so
        // anything thrown here is a bug rather than a rejected write.
        Log.error('Error copying package:')
        Log.error(e)
        setFormStatus(Err(e instanceof Error ? e : new Error('Error copying package')))
      }
    },
    [copyPackage, params, setFormStatus],
  )
}
