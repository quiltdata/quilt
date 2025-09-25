import invariant from 'invariant'
import * as React from 'react'

import cfg from 'constants/config'
import Log from 'utils/Logging'
import assertNever from 'utils/assertNever'
import { useMutation } from 'utils/GraphQL'
import * as s3paths from 'utils/s3paths'
import * as Types from 'utils/types'
import * as workflows from 'utils/workflows'

import * as requests from '../requests'

import { PackageSrc, ManifestStatus, useManifestRequest } from './State/manifest'
import * as FI from './FilesState'
import * as Uploads from './Uploads'
import { FormStatus, useFormStatus } from './State/form'
import { MessageState, useMessage } from './State/message'
import { NameState, useName } from './State/name'
import {
  README_PATH,
  FilesState,
  useFiles,
  createReadmeFile,
  FormFiles,
  groupAddedFiles,
} from './State/files'
import { SchemaStatus, useMetadataSchema, useEntriesSchema } from './State/schema'
import {
  WorkflowsConfigStatus,
  WorkflowState,
  useWorkflowsConfig,
  useWorkflow,
} from './State/workflow'
import { MetaState, useMeta } from './State/meta'
import PACKAGE_CONSTRUCT from './gql/PackageConstruct.generated'
import PACKAGE_PROMOTE from './gql/PackagePromote.generated'

export { isPackageHandle } from './State/manifest'

type ReadmeReason = 'cancel' | 'empty' | 'readme'

function workflowSelectionToWorkflow(workflow: workflows.Workflow): string | null {
  if (workflow.slug === workflows.notAvailable) return null
  if (workflow.slug === workflows.notSelected) return ''
  return workflow.slug
}

type FormParams =
  | { _tag: 'invalid'; error: Error }
  | {
      _tag: 'ok'
      params: {
        bucket: string
        message: string
        name: string
        userMeta: Types.JsonRecord | null
        workflow: string | null
      }
    }

interface PackageDst {
  bucket: string
  name?: string
}

function useSubmit() {
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
        throw { _tag: 'submitFailed', error: new Error('Error uploading files') }
      }
    },
    [uploads],
  )

  const submit = React.useCallback(
    async (
      formParams: FormParams,
      files: FormFiles,
      whenNoFiles?: 'allow' | 'add-readme',
    ): Promise<FormStatus> => {
      if (formParams._tag === 'invalid') {
        throw { _tag: 'submitFailed', error: formParams.error }
      }

      const { params } = formParams
      const local = [...files.local]
      if (!files.local.length && !Object.keys(files.remote).length) {
        switch (whenNoFiles) {
          case 'add-readme':
            const file = await createReadmeFile(params.name)
            local.push({
              file,
              path: README_PATH,
              hash: file.hash.value,
              size: file.size,
            })
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
            throw { _tag: 'submitFailed', error: new Error(r.message) }
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
            throw { _tag: 'submitFailed', error, fields }
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
        throw { _tag: 'submitFailed', error }
      }
    },
    [constructPackage, upload],
  )
  return { submit, progress: uploads.progress }
}

function useCopySubmit() {
  const promotePackage = useMutation(PACKAGE_PROMOTE)

  const copy = React.useCallback(
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
        const { packagePromote: r } = await promotePackage({
          params: {
            bucket: params.bucket,
            name: params.name,
            message: params.message,
            userMeta: params.userMeta,
            workflow: params.workflow,
          },
          src: {
            bucket: src.bucket,
            name: src.name,
            hash: src.hash,
          },
          destPrefix,
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

  return { copy }
}

interface PackageDialogState {
  values: {
    files: FilesState
    message: MessageState
    meta: MetaState
    name: NameState
    workflow: WorkflowState
  }

  src?: PackageSrc
  setSrc: (src: PackageSrc) => void
  dst: PackageDst
  setDst: React.Dispatch<React.SetStateAction<PackageDst>>

  reset: () => void
  open: boolean | FI.FilesState['added']
  setOpen: (o: boolean | FI.FilesState['added']) => void

  manifest: ManifestStatus
  workflowsConfig: WorkflowsConfigStatus
  metadataSchema: SchemaStatus
  entriesSchema: SchemaStatus

  params: FormParams
  formStatus: FormStatus
  submit: (whenNoFiles?: 'allow' | 'add-readme') => Promise<void>
  copy: (src: Required<PackageSrc>, destPrefix: string | null) => Promise<void>
  progress: Uploads.UploadTotalProgress

  onAddReadme: (r: ReadmeReason | PromiseLike<ReadmeReason>) => Promise<void>
}

const Context = React.createContext<PackageDialogState | null>(null)

export function useContext(): PackageDialogState {
  const context = React.useContext(Context)
  invariant(context, 'useContext must be used within PackageDialogProvider')
  return context
}

export const use = useContext

interface PackageDialogProviderProps {
  children: React.ReactNode
  src?: PackageSrc
  dst: PackageDst
  open?: boolean | FI.FilesState['added']
}

export function PackageDialogProvider({
  children,
  dst: initialDst,
  src: initialSrc,
  open: initialOpen = false,
}: PackageDialogProviderProps) {
  const [open, setOpen] = React.useState(initialOpen)

  const { formStatus, setFormStatus } = useFormStatus(initialOpen)

  const [src, setSrc] = React.useState(initialSrc)
  const [dst, setDst] = React.useState(initialDst)

  const reset = React.useCallback(() => {
    setSrc(initialSrc)
    setDst(initialDst)
  }, [initialSrc, initialDst])
  React.useEffect(() => reset(), [reset])

  const manifest = useManifestRequest(!!open, src)
  const workflowsConfig = useWorkflowsConfig(!!open, dst)

  const workflow = useWorkflow(manifest, workflowsConfig)

  const metadataSchema = useMetadataSchema(workflow.value)
  const entriesSchema = useEntriesSchema(workflow.value)

  const name = useName(formStatus, dst, setDst, src, workflow.value)
  const message = useMessage(formStatus)
  const meta = useMeta(formStatus, metadataSchema, manifest)
  const files = useFiles(formStatus, entriesSchema, manifest, open)

  const { progress, submit } = useSubmit()
  const { copy } = useCopySubmit()

  const params: FormParams = React.useMemo(() => {
    if (!workflow.value || workflow.status._tag === 'error') {
      return { _tag: 'invalid', error: new Error('Valid workflow required') }
    }
    if (!name.value || name.status._tag === 'error') {
      return { _tag: 'invalid', error: new Error('Valid name required') }
    }
    if (!message.value || message.status._tag === 'error') {
      return { _tag: 'invalid', error: new Error('Valid message required') }
    }

    if (metadataSchema._tag !== 'ready') {
      return {
        _tag: 'invalid',
        error: new Error('Metadata JSON Schema is not ready'),
      }
    }
    if (meta.status._tag === 'error') {
      return { _tag: 'invalid', error: new Error('Metadata must be valid') }
    }

    return {
      _tag: 'ok',
      params: {
        bucket: dst.bucket,
        message: message.value,
        name: name.value,
        userMeta: requests.getMetaValue(meta.value, metadataSchema.schema) ?? null,
        workflow: workflowSelectionToWorkflow(workflow.value),
      },
    }
  }, [dst, workflow, name, message, metadataSchema, meta])

  const handleSubmit = React.useCallback(
    async (whenNoFiles?: 'allow' | 'add-readme') => {
      setFormStatus({ _tag: 'submitting' })
      try {
        // Validate files for creation
        if (files.status._tag === 'error') {
          throw {
            _tag: 'submitFailed',
            error: new Error(
              'Files must be finished hashing and conform entries JSON Schema',
            ),
          }
        }

        const formFiles = groupAddedFiles(files.value)
        const status = await submit(params, formFiles, whenNoFiles)
        setFormStatus(status)
      } catch (error) {
        if (error instanceof Error) {
          setFormStatus({ _tag: 'submitFailed', error, fields: {} })
        } else {
          setFormStatus(error as FormStatus)
        }
      }
    },
    [params, files, setFormStatus, submit],
  )

  const handleCopy = React.useCallback(
    async (...rest: [Required<PackageSrc>, string | null]) => {
      setFormStatus({ _tag: 'submitting' })
      try {
        const status = await copy(params, ...rest)
        setFormStatus(status)
      } catch (error) {
        if (error instanceof Error) {
          setFormStatus({ _tag: 'submitFailed', error, fields: {} })
        } else {
          setFormStatus(error as FormStatus)
        }
      }
    },
    [copy, params, setFormStatus],
  )

  const onAddReadme = React.useCallback(
    async (reasonPromise: ReadmeReason | PromiseLike<ReadmeReason>) => {
      const reason = await reasonPromise

      switch (reason) {
        case 'cancel':
          setFormStatus({ _tag: 'ready' })
          break
        case 'readme':
          handleSubmit('add-readme')
          break
        case 'empty':
          handleSubmit('allow')
          break
        default:
          assertNever(reason)
      }
    },
    [handleSubmit, setFormStatus],
  )

  return (
    <Context.Provider
      value={{
        values: {
          files,
          message,
          meta,
          name,
          workflow,
        },

        reset,

        src,
        setSrc,

        dst,
        setDst,

        open,
        setOpen,

        manifest,
        workflowsConfig,
        metadataSchema,
        entriesSchema,

        submit: handleSubmit,
        copy: handleCopy,
        formStatus,
        params,
        progress,

        onAddReadme,
      }}
    >
      {children}
    </Context.Provider>
  )
}

export { PackageDialogProvider as Provider }
