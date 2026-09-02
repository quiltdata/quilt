import * as React from 'react'

import AsyncResult from 'utils/AsyncResult'
import type * as Model from 'model'

import { PreviewData, PreviewError } from '../types'

import FileType from './fileType'
import useGate from './useGate'
import * as utils from './utils'

export const FILE_TYPE = FileType.Mermaid

export const detect = utils.extIn(['.mmd', '.mermaid'])

interface MermaidLoaderProps {
  children: (result: $TSFixMe) => React.ReactNode
  gated: boolean
  handle: Model.S3.S3ObjectLocation
}

function MermaidLoader({ gated, handle, children }: MermaidLoaderProps) {
  // Diagram source is read straight from S3 rather than via the preview endpoint:
  // that endpoint returns a truncated head/tail, and a partial graph definition is
  // a syntax error rather than a shorter diagram.
  const data = utils.useObjectGetter(handle, { noAutoFetch: gated })
  const processed = utils.useProcessing(
    data.result,
    (r: { Body: Buffer }) =>
      PreviewData.Mermaid({
        contents: r.Body.toString('utf-8'),
        modes: [FileType.Mermaid, FileType.Text],
      }),
    [],
  )
  const handled = utils.useErrorHandling(processed, { handle, retry: data.fetch })
  const result =
    gated && AsyncResult.Init.is(handled)
      ? AsyncResult.Err(PreviewError.Gated({ handle, load: data.fetch }))
      : handled
  return <>{children(result)}</>
}

interface GatedMermaidLoaderProps {
  children: (result: $TSFixMe) => React.ReactNode
  handle: Model.S3.S3ObjectLocation
}

export const Loader = function GatedMermaidLoader({
  handle,
  children,
}: GatedMermaidLoaderProps) {
  const data = useGate(handle)
  const handled = utils.useErrorHandling(data.result, { handle, retry: data.fetch })
  return AsyncResult.case(
    {
      _: children,
      Ok: (gated: boolean) => <MermaidLoader {...{ gated, handle, children }} />,
    },
    handled,
  )
}
