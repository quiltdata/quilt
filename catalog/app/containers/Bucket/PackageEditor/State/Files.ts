import * as FP from 'fp-ts'
import * as R from 'ramda'
import * as React from 'react'
import { DropzoneInputProps, DropzoneRootProps, useDropzone } from 'react-dropzone'

import type * as Model from 'model'
import { L } from 'components/Form/Package/types'
import type { TreeEntry } from 'components/FileManager/FileTree'
import { useData } from 'utils/Data'
import * as AWS from 'utils/AWS'

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

export interface FilesState {
  filter: {
    value: string
  }
  staged: {
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
      staged: { map, errors, value },
    }
  }, [
    data,
    errors,
    filter,
    getInputProps,
    getRootProps,
    manifest,
    map,
    value,
    workflow.state,
  ])

  return React.useMemo(
    () => ({
      state,
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
