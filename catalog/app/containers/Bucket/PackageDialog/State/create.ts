import * as React from 'react'

import cfg from 'constants/config'
import Log from 'utils/Logging'
import assertNever from 'utils/assertNever'
import { useMutation } from 'utils/GraphQL'
import * as s3paths from 'utils/s3paths'

import * as Uploads from '../Uploads'

import PACKAGE_CONSTRUCT from '../gql/PackageConstruct.generated'

import { createReadmeFile, FormFiles, FilesState, groupAddedFiles } from './files'
import { EmptyFiles, Err, FormFieldErrors, FormStatus, Submitting, Success } from './form'
import { FormParams } from './params'

type ReadmeReason = 'cancel' | 'empty' | 'readme'

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
    if (err.path === 'src.entries') {
      fields.files = new Error(err.message)
    } else {
      error = new Error(err.message)
    }
  }
  return Err(error, fields)
}

function useCreate() {
  const constructPackage = useMutation(PACKAGE_CONSTRUCT)
  const uploads = Uploads.useUploads()

  const upload = React.useCallback(
    async (bucket: string, name: string, files: FormFiles['local']) => {
      try {
        // `await` inside the `try` so rejections are caught, not just the
        // synchronous throws.
        return await uploads.upload({
          files,
          bucket: bucket,
          getCanonicalKey: (path) => {
            if (!name) {
              throw new Error('Package name is required')
            }
            return s3paths.canonicalKey(name, path, cfg.packageRoot)
          },
        })
      } catch (e) {
        Log.error(e)
        throw new Error('Error uploading files')
      }
    },
    [uploads],
  )

  return {
    create: React.useCallback(
      async (
        formParams: FormParams,
        files: FormFiles,
        whenNoFiles?: 'allow' | 'add-readme',
      ): Promise<FormStatus> => {
        if (formParams._tag === 'invalid') return Err(formParams.error)

        const { params } = formParams
        const local = [...files.local]
        if (!files.local.length && !Object.keys(files.remote).length) {
          switch (whenNoFiles) {
            case 'add-readme':
              const readmeEntry = await createReadmeFile(params.name)
              local.push(readmeEntry)
              break
            case 'allow':
              break
            default:
              return EmptyFiles
          }
        }

        let uploadedEntries
        try {
          uploadedEntries = await upload(params.bucket, params.name, local)
        } catch (e) {
          return Err(e instanceof Error ? e : new Error('Error uploading files'))
        }

        const entries = Object.entries({
          ...files.remote,
          ...uploadedEntries,
        })
          .map(([logicalKey, f]) => ({
            logicalKey,
            physicalKey: f.physicalKey,
            hash: f.hash ?? null,
            meta: f.meta ?? null,
            size: f.size ?? null,
          }))
          .sort(({ logicalKey: a }, { logicalKey: b }) => a.localeCompare(b))

        // Only the request itself is guarded: an exception here is an unexpected
        // runtime failure, while a rejected write comes back as a typed response
        // below. Collapsing the two loses the per-field errors.
        let r
        try {
          const { packageConstruct } = await constructPackage({
            params,
            src: { entries },
          })
          r = packageConstruct
        } catch (e) {
          Log.error('Error creating manifest:')
          Log.error(e)
          return Err(
            new Error(
              e instanceof Error
                ? `Unexpected error: ${e.message}`
                : 'Error creating manifest',
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
      [constructPackage, upload],
    ),
    progress: uploads.progress,
  }
}

export type CreateHandler = (whenNoFiles?: 'allow' | 'add-readme') => Promise<void>

export type ReadmeHandler = (r: ReadmeReason | PromiseLike<ReadmeReason>) => Promise<void>

export function useCreateHandler(
  params: FormParams,
  files: FilesState,
  setFormStatus: React.Dispatch<React.SetStateAction<FormStatus>>,
): {
  create: CreateHandler
  progress: Uploads.UploadTotalProgress
  onAddReadme: ReadmeHandler
} {
  const { create: createPackage, progress } = useCreate()

  const create = React.useCallback(
    async (whenNoFiles?: 'allow' | 'add-readme') => {
      setFormStatus(Submitting)

      if (files.status._tag === 'error') {
        setFormStatus(
          Err(
            new Error(
              'Files must complete hashing and comply with the entries JSON schema',
            ),
          ),
        )
        return
      }

      try {
        const formFiles = groupAddedFiles(files.value)
        setFormStatus(await createPackage(params, formFiles, whenNoFiles))
      } catch (e) {
        // Safety net: expected failures are returned as `FormStatus`, so
        // anything thrown here is a bug rather than a rejected write.
        Log.error('Error creating package:')
        Log.error(e)
        setFormStatus(Err(e instanceof Error ? e : new Error('Error creating package')))
      }
    },
    [params, files, setFormStatus, createPackage],
  )

  const onAddReadme = React.useCallback(
    async (reasonPromise: ReadmeReason | PromiseLike<ReadmeReason>) => {
      const reason = await reasonPromise

      switch (reason) {
        case 'cancel':
          setFormStatus({ _tag: 'ready' })
          break
        case 'readme':
          create('add-readme')
          break
        case 'empty':
          create('allow')
          break
        default:
          assertNever(reason)
      }
    },
    [create, setFormStatus],
  )

  return { create, progress, onAddReadme }
}
