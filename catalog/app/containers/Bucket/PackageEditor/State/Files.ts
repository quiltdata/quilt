import * as FP from 'fp-ts'
import * as R from 'ramda'
import * as React from 'react'

import type * as Model from 'model'
import { L } from 'components/Form/Package/types'
import * as s3paths from 'utils/s3paths'
import type * as Types from 'utils/types'
import { useUploads, Uploads } from '../../PackageDialog/Uploads'

import { isS3File } from '../../PackageDialog/S3FilePicker'
import type { LocalFile } from '../../PackageDialog/FilesInput'
import { Manifest, EMPTY_MANIFEST_ENTRIES } from '../../PackageDialog/Manifest'
import {
  EntriesValidationErrors,
  ValidationEntry,
  useEntriesValidator,
} from '../../PackageDialog/PackageDialog'

import type { WorkflowContext } from './Workflow'
import NOT_READY from './errorNotReady'

export type { Uploads } from '../../PackageDialog/Uploads'

export interface FS {
  added: Record<string, LocalFile | Model.S3File>
  deleted: Record<string, true>
  existing: Model.PackageContentsFlatMap
  // XXX: workaround used to re-trigger validation and dependent computations
  // required due to direct mutations of File objects
  counter?: number
}

interface NullablePackageEntry {
  logicalKey: string
  physicalKey: string
  hash: string | null
  meta?: Model.EntryMeta | null
  size: number | null
}

interface LocalEntry {
  path: string
  file: LocalFile
}

interface S3Entry {
  path: string
  file: Model.S3File
}

type PartialPackageEntry = Types.AtLeast<Model.PackageEntry, 'physicalKey'>

export interface FilesState {
  uploads: Uploads
  value: FS | typeof L
  errors?: EntriesValidationErrors | typeof L
}

export interface FilesContext {
  state: FilesState | typeof L
  getters: {
    disabled: () => boolean
    formData: (bucket: string, name: string) => Promise<NullablePackageEntry[]>
  }
  actions: {
    onMapChange: (v: FS) => void
  }
}

export async function getFormData(
  state: FilesState | typeof L,
  bucket: string,
  name: string,
) {
  if (state === L || state.value === L) {
    throw NOT_READY
  }

  const files = state.value

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

  const uploadedEntries = await state.uploads.upload({
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
}

function isDisabled(state: FilesState | typeof L) {
  return state === L || state.errors === L || !!state.errors?.length
}

function filesStateToEntries(files: FS): ValidationEntry[] {
  return FP.function.pipe(
    R.mergeLeft(files.added, files.existing),
    R.omit(Object.keys(files.deleted)),
    Object.entries,
    R.map(([path, file]) => ({
      logical_key: path,
      meta: file.meta?.user_meta || {},
      size: file.size,
    })),
  )
}

function useValidation(value: FS | typeof L, workflow: WorkflowContext) {
  const [errors, setErrors] = React.useState<
    EntriesValidationErrors | typeof L | undefined
  >()
  const selectedWorkflow = React.useMemo(
    () => (workflow.state !== L ? workflow.state.value : null),
    [workflow.state],
  )
  const validateEntries = useEntriesValidator(selectedWorkflow || undefined)
  React.useEffect(() => {
    async function onFilesChange() {
      if (value === L) return
      const entries = filesStateToEntries(value)
      const validationErrors = await validateEntries(entries)
      setErrors(validationErrors?.length ? validationErrors : undefined)
    }
    onFilesChange()
  }, [validateEntries, value])
  return errors
}

export default function useFiles(
  workflow: WorkflowContext,
  manifest?: Manifest | typeof L,
): FilesContext {
  const uploads = useUploads()
  const [value, setValue] = React.useState<FS | typeof L>(L)

  React.useEffect(() => {
    if (manifest === L) return
    setValue({
      added: {},
      deleted: {},
      existing: manifest?.entries || EMPTY_MANIFEST_ENTRIES,
    })
  }, [manifest])

  const errors = useValidation(value, workflow)

  const state: FilesState | typeof L = React.useMemo(() => {
    if (manifest === L || workflow.state === L) return L
    return {
      value,
      errors,
      uploads,
    }
  }, [errors, manifest, value, uploads, workflow.state])

  return React.useMemo(
    () => ({
      state,
      getters: {
        formData: (bucket: string, name: string) => getFormData(state, bucket, name),
        disabled: () => isDisabled(state),
      },
      actions: {
        onMapChange: setValue,
      },
    }),
    [state],
  )
}
