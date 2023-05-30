import * as React from 'react'
import { useDropzone, DropzoneRootProps, DropzoneInputProps } from 'react-dropzone'

import type * as Model from 'model'
import { L } from 'components/Form/Package/types'
import { Status } from 'components/FileManager/FileRow'
import type { TreeEntry } from 'components/FileManager/FileTree'
import { useData } from 'utils/Data'
import * as AWS from 'utils/AWS'
import * as s3paths from 'utils/s3paths'

import { Manifest, EMPTY_MANIFEST_ENTRIES } from '../../PackageDialog/Manifest'
import * as requests from '../../requests'

import type { WorkflowContext } from './Workflow'
import type { Src } from './Source'

// export const TAB_BOOKMARKS = Symbol('bookmarks')
// export const TAB_S3 = Symbol('s3')
// export type Tab = typeof TAB_S3 | typeof TAB_BOOKMARKS | typeof L

function sortEntries(entries: TreeEntry[]): TreeEntry[] {
  return [...entries].sort((a, b) => {
    if (a.children && !b.children) return -1
    if (!a.children && b.children) return 1
    return a.name.localeCompare(b.name)
  })
}

interface FilesState {
  filter: {
    value: string
  }
  staged: {
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
    }
    remote: {
      onChange: (v: { path: string; files: Model.S3File[] }) => void
    }
  }
}

function calcChildren(
  entry: Model.PackageEntry | Model.S3File,
  tailParts: string[],
  children: TreeEntry[] = [],
): TreeEntry[] {
  const [name, ...tail] = tailParts
  const found = children.find((child) => child.id === name)
  if (found) {
    if (tail.length) {
      found.children = calcChildren(entry, tail, found.children)
    }
    return children
  }

  return children.concat({
    id: name,
    name: tail.length ? s3paths.ensureSlash(name) : name,
    size: tail.length ? 0 : entry.size,
    status: Status.Unchanged,
    children: tail.length ? calcChildren(entry, tail, []) : undefined,
  })
}

function convertS3FilesListToTree(path: string, files: Model.S3File[]): TreeEntry[] {
  const rootMap = files.reduce((memo, file) => {
    const filePath = s3paths.withoutPrefix(path, file.key)
    const pathParts = filePath.split('/')
    if (pathParts.length === 1) {
      return {
        ...memo,
        [filePath]: {
          id: filePath,
          name: filePath,
          size: file.size,
          status: Status.S3,
        },
      }
    }
    const [head, ...tail] = pathParts
    const dir =
      memo[head] ||
      ({
        id: head,
        name: s3paths.ensureSlash(head),
        size: 0,
        status: Status.S3,
        children: [],
      } as TreeEntry)

    dir.children = sortEntries(calcChildren(file, tail, dir.children))

    return {
      ...memo,
      [head]: dir,
    }
  }, {} as Record<string, TreeEntry>)
  return sortEntries(Object.values(rootMap))
}

function convertFilesMapToTree(map: Model.PackageContentsFlatMap): TreeEntry[] {
  const rootMap = Object.entries(map).reduce((memo, [name, entry]) => {
    const pathParts = name.split('/')

    if (pathParts.length === 1) {
      return {
        ...memo,
        [name]: {
          id: entry.physicalKey,
          name,
          size: entry.size,
          status: Status.Unchanged,
        },
      }
    }

    const [head, ...tail] = pathParts
    const dir =
      memo[head] ||
      ({
        id: head,
        name: s3paths.ensureSlash(head),
        size: 0,
        status: Status.Unchanged,
        children: [],
      } as TreeEntry)

    dir.children = sortEntries(calcChildren(entry, tail, dir.children))

    return {
      ...memo,
      [head]: dir,
    }
  }, {} as Record<string, TreeEntry>)
  return sortEntries(Object.values(rootMap))
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

export default function useFiles(
  src: Src,
  workflow: WorkflowContext,
  manifest?: Manifest | typeof L,
): FilesContext {
  // useRemoteFilesLists(src)
  const s3 = AWS.S3.use()
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
  const { getRootProps, getInputProps, open: openFilePicker } = useDropzone()
  const [filter, setFilter] = React.useState('')
  // const [tab, setTab] = React.useState<Tab>(TAB_S3)
  const [value, setValue] = React.useState<TreeEntry[] | typeof L>(L)
  const handleS3FilePicker = React.useCallback(
    ({ path, files }: { path: string; files: Model.S3File[] }) => {
      setValue((x) => {
        if (x === L) return x
        return [...x, ...convertS3FilesListToTree(path, files)]
      })
    },
    [],
  )
  React.useEffect(() => {
    if (manifest === L) return
    setValue(() => convertFilesMapToTree(manifest?.entries || EMPTY_MANIFEST_ENTRIES))
  }, [manifest])

  const state: FilesState | typeof L = React.useMemo(() => {
    if (manifest === L || workflow.state === L) return L
    return {
      // tab,
      filter: {
        value: filter,
      },
      staged: {
        value,
      },
      remote: data,
      dropzone: {
        root: getRootProps(),
        input: getInputProps(),
      },
    }
  }, [data, getRootProps, getInputProps, filter, manifest, workflow.state, value])
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
        },
        remote: {
          onChange: handleS3FilePicker,
        },
      },
    }),
    [handleS3FilePicker, state, openFilePicker],
  )
}
