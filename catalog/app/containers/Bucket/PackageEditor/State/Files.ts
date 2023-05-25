import * as React from 'react'
import { useDropzone, DropzoneRootProps, DropzoneInputProps } from 'react-dropzone'

import type * as Model from 'model'
import { L } from 'components/Form/Package/types'

import { Manifest, EMPTY_MANIFEST_ENTRIES } from '../../PackageDialog/Manifest'

import type { WorkflowContext } from './Workflow'

interface FilesState {
  value?: Model.PackageContentsFlatMap
  dropzone: {
    root: DropzoneRootProps
    input: DropzoneInputProps
  }
}

export interface FilesContext {
  state: FilesState | typeof L
  actions: {
    openFilePicker: () => void
  }
}

export default function useFiles(
  workflow: WorkflowContext,
  manifest?: Manifest | typeof L,
): FilesContext {
  const { getRootProps, getInputProps, open: openFilePicker } = useDropzone()
  const state = React.useMemo(() => {
    if (manifest === L || workflow.state === L) return L
    return {
      value: manifest?.entries || EMPTY_MANIFEST_ENTRIES,
      dropzone: {
        root: getRootProps(),
        input: getInputProps(),
      },
    }
  }, [getRootProps, getInputProps, manifest, workflow.state])
  return React.useMemo(
    () => ({
      state,
      actions: {
        openFilePicker,
      },
    }),
    [state, openFilePicker],
  )
}
