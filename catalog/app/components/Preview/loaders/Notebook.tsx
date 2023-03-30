import * as R from 'ramda'
import * as React from 'react'

import type * as Model from 'model'
import { PackageHandle } from 'utils/packageHandle'
import { useVoila } from 'utils/voila'

import { PreviewData } from '../types'
import FileType from './fileType'
import * as utils from './utils'

export const detect = R.pipe(utils.stripCompression, utils.extIs('.ipynb'))

interface PreviewResult {
  html: string
  info: {
    data: {
      head: string[]
      tail: string[]
    }
    note?: string
    warnings?: string
  }
}

interface FileHandle extends Model.S3.S3ObjectLocation {
  packageHandle: PackageHandle
}

interface NotebookLoaderProps {
  children: (result: $TSFixMe) => React.ReactNode
  handle: FileHandle
}

function NotebookLoader({ handle, children }: NotebookLoaderProps) {
  const voilaAvailable = useVoila()
  const data = utils.usePreview({ type: 'ipynb', handle, query: undefined })
  const processed = utils.useProcessing(data.result, (json: PreviewResult) =>
    PreviewData.Notebook({
      preview: json.html,
      note: json.info.note,
      warnings: json.info.warnings,
      modes:
        !!handle.packageHandle && voilaAvailable
          ? [FileType.Jupyter, FileType.Json, FileType.Voila, FileType.Text]
          : [FileType.Jupyter, FileType.Json, FileType.Text],
    }),
  )
  return <>{children(utils.useErrorHandling(processed, { handle, retry: data.fetch }))}</>
}

export const Loader = function WrappedNotebookLoader({
  handle,
  children,
}: NotebookLoaderProps) {
  return <NotebookLoader {...{ handle, children }} />
}
