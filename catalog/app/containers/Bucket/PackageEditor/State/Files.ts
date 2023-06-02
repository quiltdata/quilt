import * as FP from 'fp-ts'
import * as R from 'ramda'
import * as React from 'react'
import { DropzoneInputProps, DropzoneRootProps, useDropzone } from 'react-dropzone'

import type * as Model from 'model'
import type { TreeEntry } from 'components/FileManager/FileTree'
import { L } from 'components/Form/Package/types'
import * as AWS from 'utils/AWS'
import { useData } from 'utils/Data'
import * as s3paths from 'utils/s3paths'
import type * as Types from 'utils/types'
import { useUploads } from '../../PackageDialog/Uploads'

import { isS3File } from '../../PackageDialog/S3FilePicker'
import type { LocalFile } from '../../PackageDialog/FilesInput'
import { Manifest, EMPTY_MANIFEST_ENTRIES } from '../../PackageDialog/Manifest'
import {
  EntriesValidationErrors,
  ValidationEntry,
  useEntriesValidator,
} from '../../PackageDialog/PackageDialog'
import * as requests from '../../requests'

import type { WorkflowContext } from './Workflow'
import type { Src } from './Source'
import convertDesktopFilesToTree from './adapters/desktop'
// import convertFilesMapToTree from './adapters/manifest'
import convertS3FilesListToTree from './adapters/s3'
// import convertTreeToFilesMap from './adapters/package'
import { sortEntries } from './adapters/utils'
import NOT_READY from './errorNotReady'

// export const TAB_BOOKMARKS = Symbol('bookmarks')
// export const TAB_S3 = Symbol('s3')
// export type Tab = typeof TAB_S3 | typeof TAB_BOOKMARKS | typeof L

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

export type Uploads = $TSFixMe

export interface FilesState {
  filter: {
    value: string
  }
  staged: {
    uploads: Uploads
    map: FS | typeof L
    errors?: EntriesValidationErrors | typeof L
    value: TreeEntry[] | typeof L
  }
  // tab: Tab
  remote: $TSFixMe
  dropzone: {
    root: DropzoneRootProps
    input: DropzoneInputProps
  }
}

export interface FilesContext {
  state: FilesState | typeof L
  getters: {
    disabled: () => boolean
    formData: (bucket: string, name: string) => Promise<NullablePackageEntry[]>
  }
  actions: {
    dropzone: {
      openFilePicker: () => void
    }
    // onTab: (t: Tab) => void
    filter: {
      onChange: (v: string) => void
    }
    staged: {
      onChange: (v: TreeEntry[]) => void
      onMapChange: (v: FS) => void
    }
    remote: {
      onChange: (v: { path: string; files: Model.S3File[] }) => void
    }
  }
}

export async function getFormData(
  state: FilesState | typeof L,
  bucket: string,
  name: string,
) {
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

  const uploadedEntries = await state.staged.uploads.upload({
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

export function isDisabled(state: FilesState | typeof L) {
  return state === L || state.staged.errors === L || !!state.staged.errors?.length
}

// FIXME: it's not finished
// function useRemoteFilesLists(src: Src) {
//   const [map, setMap] = React.useState<Record<string, TreeEntry[] | typeof L>>({})
//   const store = React.useRef<Record<string, Promise<TreeEntry[]>>>({})
//   const s3 = AWS.S3.use()
//   const fetch = React.useCallback(
//     async (bucket: string, path: string = '') => {
//       if (!!store.current[path]) return store.current[path]
//
//       setMap((x) => ({ ...x, [path]: L }))
//       store.current[path] =
//         store.current[path] ||
//         requests
//           .bucketListing({
//             s3,
//             bucket,
//             path,
//             prefix: '',
//             // prev: null,
//           })
//           .then((r) => {
//             return [
//               ...r.dirs.map((name) => ({
//                 id: name,
//                 name,
//                 children: [],
//               })),
//               ...r.files.map((file) => ({
//                 id: file.key,
//                 modifiedDate: file.modified,
//                 name: file.key,
//                 size: file.size,
//               })),
//             ]
//           })
//
//       const list = await store.current[path]
//       setMap((x) => ({
//         ...x,
//         [path]: list,
//       }))
//     },
//     [map, s3],
//   )
//   React.useEffect(() => {
//     fetch(src.bucket, src.s3Path)
//   }, [fetch])
//   return map['']
// }

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

export default function useFiles(
  src: Src,
  workflow: WorkflowContext,
  manifest?: Manifest | typeof L,
): FilesContext {
  // useRemoteFilesLists(src)
  const s3 = AWS.S3.use()
  const [errors, setErrors] = React.useState<
    EntriesValidationErrors | typeof L | undefined
  >()
  const selectedWorkflow = React.useMemo(
    () => (workflow.state !== L ? workflow.state.value : null),
    [workflow.state],
  )
  const validateEntries = useEntriesValidator(selectedWorkflow || undefined)
  const data = useData(
    requests.bucketListing,
    {
      s3,
      bucket: src.bucket,
      path: src.s3Path || '',
      prefix: '',
      prev: null,
    },
    // FIXME: { noAutoFetch },
  )
  const onDrop = React.useCallback(async (files) => {
    // setHashing(true)
    // const hashingFiles: LocalFile[] = files.map(computeHash)
    // await Promise.all(hashingFiles.map(({ hash }) => hash.promise))
    setValue((x) => {
      if (x === L) return x
      return sortEntries([...x, ...convertDesktopFilesToTree(files)])
    })
    // setHashing(false)
  }, [])
  const { getRootProps, getInputProps, open: openFilePicker } = useDropzone({ onDrop })
  const uploads = useUploads()
  const [filter, setFilter] = React.useState('')
  // const [tab, setTab] = React.useState<Tab>(TAB_S3)
  const [value, setValue] = React.useState<TreeEntry[] | typeof L>(L)
  const [map, setMap] = React.useState<FS | typeof L>(L)
  const handleS3FilePicker = React.useCallback(
    ({ path, files }: { path: string; files: Model.S3File[] }) => {
      setValue((x) => {
        if (x === L) return x
        return sortEntries([...x, ...convertS3FilesListToTree(path, files)])
      })
    },
    [],
  )

  React.useEffect(() => {
    if (manifest === L) return
    // setValue(() => convertFilesMapToTree(manifest?.entries || EMPTY_MANIFEST_ENTRIES))
    setMap({
      added: {},
      deleted: {},
      existing: manifest?.entries || EMPTY_MANIFEST_ENTRIES,
    })
  }, [manifest])

  // TODO: use setValue(x, CALLBACK)
  React.useEffect(() => {
    async function onFilesChange() {
      if (map === L) return
      // const entries = convertTreeToFilesMap(value, '')
      const entries = filesStateToEntries(map)
      const validationErrors = await validateEntries(entries)
      setErrors(validationErrors?.length ? validationErrors : undefined)
    }
    onFilesChange()
  }, [validateEntries, map])

  const state: FilesState | typeof L = React.useMemo(() => {
    if (manifest === L || workflow.state === L) return L
    return {
      // tab,
      dropzone: {
        root: getRootProps(),
        input: getInputProps(),
      },
      filter: { value: filter },
      remote: data,
      staged: { map, errors, uploads, value },
    }
  }, [
    data,
    errors,
    filter,
    getInputProps,
    getRootProps,
    manifest,
    map,
    uploads,
    value,
    workflow.state,
  ])

  return React.useMemo(
    () => ({
      state,
      getters: {
        formData: (bucket: string, name: string) => getFormData(state, bucket, name),
        disabled: () => isDisabled(state),
      },
      actions: {
        dropzone: {
          openFilePicker,
        },
        // onTab: setTab,
        filter: {
          onChange: setFilter,
        },
        staged: {
          onChange: setValue,
          onMapChange: setMap,
        },
        remote: {
          onChange: handleS3FilePicker,
        },
      },
    }),
    [handleS3FilePicker, state, openFilePicker],
  )
}
