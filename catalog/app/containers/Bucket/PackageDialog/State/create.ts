import * as React from 'react'

import cfg from 'constants/config'
import Log from 'utils/Logging'
import assertNever from 'utils/assertNever'
import { useMutation } from 'utils/GraphQL'
import * as s3paths from 'utils/s3paths'

import * as Uploads from '../Uploads'

import PACKAGE_CONSTRUCT from '../gql/PackageConstruct.generated'

import { createReadmeFile, FormFiles, FilesState, groupAddedFiles } from './files'
import { FormStatus } from './form'
import { FormParams } from './params'

type ReadmeReason = 'cancel' | 'empty' | 'readme'

function useCreate() {
  const constructPackage = useMutation(PACKAGE_CONSTRUCT)
  const uploads = Uploads.useUploads()

  const upload = React.useCallback(
    (bucket: string, name: string, files: FormFiles['local']) => {
      try {
        return uploads.upload({
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
        throw { _tag: 'error', error: new Error('Error uploading files') }
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
        if (formParams._tag === 'invalid') {
          throw { _tag: 'error', error: formParams.error }
        }

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
              throw { _tag: 'emptyFiles' }
          }
        }

        Log.log(local, files.remote, params)

        const uploadedEntries = await upload(params.bucket, params.name, local)

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

        try {
          const { packageConstruct: r } = await constructPackage({
            params,
            src: { entries },
          })
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
              throw { _tag: 'error', error: new Error(r.message) }
            case 'InvalidInput':
              const fields: Record<string, Error> = {}
              let error = new Error('Something went wrong')
              for (let err of r.errors) {
                if (err.path === 'src.entries') {
                  fields.files = new Error(err.message)
                } else {
                  error = new Error(err.message)
                }
              }
              throw { _tag: 'error', error, fields }
            default:
              assertNever(r)
          }
        } catch (e) {
          Log.error('Error creating manifest:')
          Log.error(e)
          const error = new Error(
            e instanceof Error
              ? `Unexpected error: ${e.message}`
              : 'Error creating manifest',
          )
          throw { _tag: 'error', error }
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
      setFormStatus({ _tag: 'submitting' })
      try {
        if (files.status._tag === 'error') {
          throw {
            _tag: 'error',
            error: new Error(
              'Files must be finished hashing and conform entries JSON Schema',
            ),
          }
        }

        const formFiles = groupAddedFiles(files.value)
        const status = await createPackage(params, formFiles, whenNoFiles)
        setFormStatus(status)
      } catch (error) {
        if (error instanceof Error) {
          setFormStatus({ _tag: 'error', error, fields: {} })
        } else {
          setFormStatus(error as FormStatus)
        }
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
