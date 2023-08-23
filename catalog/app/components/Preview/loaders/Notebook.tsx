import * as R from 'ramda'
import * as React from 'react'

import type * as Model from 'model'
import AsyncResult from 'utils/AsyncResult'
import { useVoila } from 'utils/voila'

import { PreviewData } from '../types'
import FileType from './fileType'
import * as summarize from './summarize'
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

interface LoaderOptions extends summarize.FileExtended {
  handle?: Model.Package.Handle
  hash?: Model.Package.Hash
}

interface NotebookLoaderProps {
  children: (result: $TSFixMe) => React.ReactNode
  handle: Model.S3.S3ObjectLocation
  options: LoaderOptions
}

function NotebookLoader({ handle, children, options }: NotebookLoaderProps) {
  const voilaAvailable = useVoila()
  const data = utils.usePreview({ type: 'ipynb', handle, query: undefined })
  const processed = utils.useProcessing(data.result, (json: PreviewResult) =>
    PreviewData.Notebook({
      preview: json.html,
      note: json.info.note,
      warnings: json.info.warnings,
      modes:
        !!options.handle && voilaAvailable
          ? [FileType.Jupyter, FileType.Json, FileType.Voila, FileType.Text]
          : [FileType.Jupyter, FileType.Json, FileType.Text],
    }),
  )
  return <>{children(utils.useErrorHandling(processed, { handle, retry: data.fetch }))}</>
}

export const Loader = function WrappedNotebookLoader({
  handle,
  children,
  options,
}: NotebookLoaderProps) {
  return (
    <React.Suspense fallback={() => children(AsyncResult.Pending())}>
      <NotebookLoader {...{ handle, children, options }} />
    </React.Suspense>
  )
}
