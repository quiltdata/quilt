import * as FP from 'fp-ts'
import * as R from 'ramda'
import * as React from 'react'

import { L } from 'components/Form/Package/types'
import type * as Model from 'model'
import { useMutation } from 'utils/GraphQL'
import assertNever from 'utils/assertNever'
import * as s3paths from 'utils/s3paths'
import type * as Types from 'utils/types'
import { notAvailable, notSelected } from 'utils/workflows'

import PACKAGE_CONSTRUCT from '../../PackageDialog/gql/PackageConstruct.generated'
import { isS3File } from '../../PackageDialog/S3FilePicker'
import type { LocalFile } from '../../PackageDialog/FilesInput'
import { useUploads } from '../../PackageDialog/Uploads'

import type { BucketState, BucketContext } from './Bucket'
import type { FilesState, FilesContext } from './Files'
import type { MessageState, MessageContext } from './Message'
import type { MetaState, MetaContext } from './Meta'
import type { NameState, NameContext } from './Name'
import type { WorkflowState, WorkflowContext } from './Workflow'

type PartialPackageEntry = Types.AtLeast<Model.PackageEntry, 'physicalKey'>

export interface LocalEntry {
  path: string
  file: LocalFile
}

export interface S3Entry {
  path: string
  file: Model.S3File
}

interface Success {
  name: string
  hash: string
}

interface MainState {
  disabled: boolean
  errors: Error[] | null
  submitted: boolean
  success: Success | null
}

export interface MainContext {
  state: MainState | typeof L
  actions: {
    onSubmit: () => void
  }
}

interface Everything {
  bucket: BucketContext
  files: FilesContext
  message: MessageContext
  meta: MetaContext
  name: NameContext
  workflow: WorkflowContext
}

function useDisabled({ files, message, meta, name, workflow }: Everything) {
  return React.useMemo(() => {
    if (name.state === L) return true
    if (
      name.state.errors === L ||
      name.state.errors?.length ||
      name.state.warnings === L
    ) {
      return true
    }

    if (message.state.errors?.length) return true

    if (workflow.state === L || workflow.state.errors?.length) return true
    if (
      files.state === L ||
      files.state.staged.errors === L ||
      files.state.staged.errors?.length
    ) {
      return true
    }

    if (meta.state === L || meta.state.errors === L || meta.state.errors?.length) {
      return true
    }

    return false
  }, [files.state, name.state, message.state, meta.state, workflow.state])
}

const NOT_READY = new Error('Not ready')

function useName(state: NameState | typeof L): () => string {
  return React.useCallback(() => {
    if (state === L) {
      throw NOT_READY
    }
    return state.value
  }, [state])
}

function useMessage(state: MessageState): () => string {
  return React.useCallback(() => state.value, [state.value])
}

function useBucket(state: BucketState): () => string {
  return React.useCallback(() => {
    if (!state.value) {
      throw NOT_READY
    }
    return state.value.name
  }, [state])
}

function useWorkflow(state: WorkflowState | typeof L): () => string | null {
  return React.useCallback(() => {
    if (state === L || !state.value) {
      throw NOT_READY
    }
    const workflowSlug = state.value.slug
    switch (workflowSlug) {
      case notAvailable:
        return null
      case notSelected:
        return ''
      default:
        return workflowSlug
    }
  }, [state])
}

interface NullablePackageEntry {
  logicalKey: string
  physicalKey: string
  hash: string | null
  meta?: Model.EntryMeta | null
  size: number | null
}

function useFiles(
  state: FilesState | typeof L,
): (b: string, n: string) => Promise<NullablePackageEntry[]> {
  const uploads = useUploads()

  return React.useCallback(
    async (bucket: string, name: string) => {
      if (state === L || state.staged.map === L) {
        throw NOT_READY
      }

      const files = state.staged.map

      const addedS3Entries: S3Entry[] = []
      const addedLocalEntries: LocalEntry[] = []
      Object.entries(files.added).forEach(([path, file]) => {
        if (isS3File(file)) {
          addedS3Entries.push({ path, file })
        } else {
          addedLocalEntries.push({ path, file })
        }
      })

      const toUpload = addedLocalEntries.filter(({ path, file }) => {
        const e = files.existing[path]
        return !e || e.hash !== file.hash.value
      })

      const uploadedEntries = await uploads.upload({
        files: toUpload,
        bucket,
        prefix: name,
        getMeta: (path: string) => files.existing[path]?.meta || files.added[path]?.meta,
      })

      const s3Entries = FP.function.pipe(
        addedS3Entries,
        R.map(
          ({ path, file }) =>
            [
              path,
              { physicalKey: s3paths.handleToS3Url(file), meta: file.meta },
            ] as R.KeyValuePair<string, PartialPackageEntry>,
        ),
        R.fromPairs,
      )

      const allEntries = FP.function.pipe(
        files.existing,
        R.omit(Object.keys(files.deleted)),
        R.mergeLeft(uploadedEntries),
        R.mergeLeft(s3Entries),
        R.toPairs,
        R.map(([logicalKey, data]: [string, PartialPackageEntry]) => ({
          logicalKey,
          physicalKey: data.physicalKey,
          hash: data.hash ?? null,
          meta: data.meta ?? null,
          size: data.size ?? null,
        })),
        R.sortBy(R.prop('logicalKey')),
      )
      return allEntries
    },
    [state, uploads],
  )
}

function useMeta(state: MetaState | typeof L): () => Types.JsonRecord | null {
  return React.useCallback(() => {
    if (state === L) {
      throw NOT_READY
    }
    return state.value || null
  }, [state])
}

interface FormData {
  params: {
    bucket: string
    message: string
    userMeta: Types.JsonRecord | null
    name: string
    workflow: string | null
  }
  src: {
    entries: $TSFixMe
  }
}

function useFormData(ctx: Everything): () => Promise<FormData> {
  const getName = useName(ctx.name.state)
  const getBucket = useBucket(ctx.bucket.state)
  const getMessage = useMessage(ctx.message.state)
  const getMeta = useMeta(ctx.meta.state)
  const getWorkflow = useWorkflow(ctx.workflow.state)
  const getFiles = useFiles(ctx.files.state)
  return React.useCallback(async () => {
    const name = getName()
    const bucket = getBucket()
    const entries = await getFiles(bucket, name)

    const message = getMessage()
    const userMeta = getMeta()
    const workflow = getWorkflow()
    return { params: { name, message, bucket, workflow, userMeta }, src: { entries } }
  }, [getBucket, getFiles, getMessage, getMeta, getName, getWorkflow])
}

function useCreatePackage() {
  const constructPackage = useMutation(PACKAGE_CONSTRUCT)
  return React.useCallback(
    async (formData: FormData) => {
      const { packageConstruct } = await constructPackage(formData)
      return packageConstruct
    },
    [constructPackage],
  )
}

export default function useMain(ctx: Everything): MainContext {
  const disabled = useDisabled(ctx)
  const [errors, setErrors] = React.useState<Error[] | null>(null)
  const getFormData = useFormData(ctx)
  const createPackage = useCreatePackage()
  const [submitted, setSubmitted] = React.useState(false)
  const [success, setSuccess] = React.useState<Success | null>(null)
  const onSubmit = React.useCallback(async () => {
    setSubmitted(true)
    if (disabled) return
    try {
      const formData = await getFormData()
      const r = await createPackage(formData)
      switch (r.__typename) {
        case 'PackagePushSuccess':
          setSuccess({ name: formData.params.name, hash: r.revision.hash })
          break
        case 'OperationError':
          setErrors([new Error(r.message)])
          break
        case 'InvalidInput':
          setErrors(r.errors.map(({ message }) => new Error(message)))
          break
        default:
          assertNever(r)
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(error)
    }
  }, [createPackage, disabled, getFormData])

  const state = React.useMemo(
    () => ({
      disabled: submitted && disabled,
      submitted,
      success,
      errors,
    }),
    [errors, disabled, submitted, success],
  )

  return React.useMemo(
    () => ({
      state,
      actions: {
        onSubmit,
      },
    }),
    [state, onSubmit],
  )
}
