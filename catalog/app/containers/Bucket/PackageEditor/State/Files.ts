import * as React from 'react'
import { useDropzone, DropzoneRootProps, DropzoneInputProps } from 'react-dropzone'

import type * as Model from 'model'
import { L } from 'components/Form/Package/types'

import { Manifest, EMPTY_MANIFEST_ENTRIES } from '../../PackageDialog/Manifest'

import type { WorkflowContext } from './Workflow'

export const TAB_BOOKMARKS = Symbol('bookmarks')
export const TAB_S3 = Symbol('s3')
export type Tab = typeof TAB_S3 | typeof TAB_BOOKMARKS | typeof L

interface FilesState {
  filter: {
    value: string
  }
  tab: Tab
  value: Model.PackageContentsFlatMap
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
    onTab: (t: Tab) => void
    filter: {
      onChange: (v: string) => void
    }
  }
}

export default function useFiles(
  workflow: WorkflowContext,
  manifest?: Manifest | typeof L,
): FilesContext {
  const { getRootProps, getInputProps, open: openFilePicker } = useDropzone()
  const [filter, setFilter] = React.useState('')
  const [tab, setTab] = React.useState<Tab>(TAB_S3)
  const state: FilesState | typeof L = React.useMemo(() => {
    if (manifest === L || workflow.state === L) return L
    return {
      tab,
      filter: {
        value: filter,
      },
      value: manifest?.entries || EMPTY_MANIFEST_ENTRIES,
      dropzone: {
        root: getRootProps(),
        input: getInputProps(),
      },
    }
  }, [getRootProps, getInputProps, filter, tab, manifest, workflow.state])
  return React.useMemo(
    () => ({
      state,
      actions: {
        dropzone: {
          openFilePicker,
        },
        onTab: setTab,
        filter: {
          onChange: setFilter,
        },
      },
    }),
    [state, openFilePicker],
  )
}
