import * as React from 'react'
import { useDropzone, DropzoneRootProps, DropzoneInputProps } from 'react-dropzone'

import type * as Model from 'model'
import { L } from 'components/Form/Package/types'
import { Status } from 'components/FileManager/FileRow'
import type { TreeEntry } from 'components/FileManager/FileTree'
import { useData } from 'utils/Data'
import * as AWS from 'utils/AWS'

import { Manifest, EMPTY_MANIFEST_ENTRIES } from '../../PackageDialog/Manifest'
import * as requests from '../../requests'

import type { WorkflowContext } from './Workflow'

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
  // tab: Tab
  value: Model.PackageContentsFlatMap
  tree: TreeEntry[]
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
  }
}

function calcChildren(
  entry: Model.PackageEntry,
  tailParts: string[],
  children: TreeEntry[] = [],
): TreeEntry[] {
  const [name, ...tail] = tailParts
  const found = children.find((child) => child.name === name)
  if (found) {
    if (tail.length) {
      found.children = calcChildren(entry, tail, found.children)
    }
    return children
  }

  return children.concat({
    id: name,
    name,
    size: tail.length ? 0 : entry.size,
    status: Status.Unchanged,
    children: tail.length ? calcChildren(entry, tail, []) : undefined,
  })
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
        name: head,
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

export default function useFiles(
  workflow: WorkflowContext,
  manifest?: Manifest | typeof L,
): FilesContext {
  const s3 = AWS.S3.use()
  const data = useData(
    requests.bucketListing,
    {
      s3,
      bucket: 'fiskus-sandbox-dev',
      path: '',
      prefix: '',
      prev: null,
    },
    // FIXME: { noAutoFetch },
  )
  const { getRootProps, getInputProps, open: openFilePicker } = useDropzone()
  const [filter, setFilter] = React.useState('')
  // const [tab, setTab] = React.useState<Tab>(TAB_S3)
  const state: FilesState | typeof L = React.useMemo(() => {
    if (manifest === L || workflow.state === L) return L
    return {
      // tab,
      filter: {
        value: filter,
      },
      value: manifest?.entries || EMPTY_MANIFEST_ENTRIES,
      tree: convertFilesMapToTree(manifest?.entries || EMPTY_MANIFEST_ENTRIES),
      remote: data,
      dropzone: {
        root: getRootProps(),
        input: getInputProps(),
      },
    }
  }, [data, getRootProps, getInputProps, filter, manifest, workflow.state])
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
      },
    }),
    [state, openFilePicker],
  )
}
