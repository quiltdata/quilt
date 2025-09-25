import * as React from 'react'

import Log from 'utils/Logging'
import assertNever from 'utils/assertNever'
import { useMutation } from 'utils/GraphQL'

import PACKAGE_PROMOTE from '../gql/PackagePromote.generated'

import { FormStatus } from './form'
import { FormParams } from './params'
import { PackageSrc } from './manifest'

function useCopy() {
  const promotePackage = useMutation(PACKAGE_PROMOTE)

  return React.useCallback(
    async (
      formParams: FormParams,
      src: Required<PackageSrc>,
      destPrefix: string | null,
    ): Promise<FormStatus> => {
      if (formParams._tag === 'invalid') {
        throw { _tag: 'submitFailed', error: formParams.error }
      }

      const { params } = formParams

      try {
        const { packagePromote: r } = await promotePackage({ params, src, destPrefix })

        switch (r.__typename) {
          case 'PackagePushSuccess':
            return {
              _tag: 'success',
              handle: {
                bucket: params.bucket,
                name: params.name,
                hash: r.revision.hash,
              },
            }
          case 'OperationError':
            throw { _tag: 'submitFailed', error: new Error(r.message) }
          case 'InvalidInput':
            const fields: Record<string, Error> = {}
            let error = new Error('Something went wrong')
            for (let err of r.errors) {
              if (err.path === 'params.name') {
                fields.name = new Error(err.message)
              } else if (err.path === 'params.message') {
                fields.message = new Error(err.message)
              } else if (err.path === 'params.userMeta') {
                fields.meta = new Error(err.message)
              } else if (err.path === 'params.workflow') {
                fields.workflow = new Error(err.message)
              } else {
                error = new Error(err.message)
              }
            }
            throw { _tag: 'submitFailed', error, fields }
          default:
            assertNever(r)
        }
      } catch (e) {
        Log.error('Error copying package:')
        Log.error(e)
        const error = new Error(
          e instanceof Error ? `Unexpected error: ${e.message}` : 'Error copying package',
        )
        throw { _tag: 'submitFailed', error }
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
      setFormStatus({ _tag: 'submitting' })
      try {
        const status = await copyPackage(params, src, destPrefix)
        setFormStatus(status)
      } catch (error) {
        if (error instanceof Error) {
          setFormStatus({ _tag: 'submitFailed', error, fields: {} })
        } else {
          setFormStatus(error as FormStatus)
        }
      }
    },
    [copyPackage, params, setFormStatus],
  )
}
