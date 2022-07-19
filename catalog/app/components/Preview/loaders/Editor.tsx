import * as React from 'react'

import * as AWS from 'utils/AWS'
import AsyncResult from 'utils/AsyncResult'
import pipeThru from 'utils/pipeThru'
import type { S3HandleBase } from 'utils/s3paths'

import { PreviewData, PreviewError } from '../types'

import * as utils from './utils'
import * as Markdown from './Markdown'

export const detect = (key: string, { editing }: { editing: boolean }) =>
  editing && Markdown.detect(key)

interface MarkdownLoaderProps {
  gated: boolean
  handle: S3HandleBase
  children: (r: $TSFixMe) => React.ReactNode
}

function MarkdownLoader({ gated, handle, children }: MarkdownLoaderProps) {
  const s3 = AWS.S3.use()

  const data = utils.useObjectGetter(handle, { noAutoFetch: gated })

  const writeData = React.useCallback(
    async (value) => {
      await s3
        .putObject({ Bucket: handle.bucket, Key: handle.key, Body: value })
        .promise()
    },
    [handle, s3],
  )
  const processed = utils.useProcessing(
    data.result,
    (r: $TSFixMe) => {
      const value = r.Body.toString('utf-8')
      return PreviewData.Editor({ value, onChange: writeData })
    },
    [],
  )
  const handled = utils.useErrorHandling(processed, { handle, retry: data.fetch })
  const result =
    gated && AsyncResult.Init.is(handled)
      ? AsyncResult.Err(PreviewError.Gated({ handle, load: data.fetch }))
      : handled
  return <>{children(result)}</>
}

interface LoaderProps {
  handle: S3HandleBase
  children: (r: $TSFixMe) => React.ReactNode
}

export const Loader = function GatedEditorLoader({ handle, children }: LoaderProps) {
  const data = utils.useGate(handle)
  const handled = utils.useErrorHandling(data.result, { handle, retry: data.fetch })
  return pipeThru(handled)(
    AsyncResult.case({
      _: children,
      Ok: (gated: boolean) => <MarkdownLoader {...{ gated, handle, children }} />,
    }),
  )
}
