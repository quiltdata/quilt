import * as React from 'react'

import * as AWS from 'utils/AWS'
import AsyncResult from 'utils/AsyncResult'
import type { S3HandleBase } from 'utils/s3paths'

import { PreviewData, PreviewError } from '../types'

import * as utils from './utils'
import * as Markdown from './Markdown'

export const detect = (key: string, { onChange }: { onChange: (v: string) => void }) =>
  !!onChange && Markdown.detect(key)

export function useWriteData({ bucket, key }: S3HandleBase) {
  const s3 = AWS.S3.use()
  return React.useCallback(
    async (value) => {
      await s3.putObject({ Bucket: bucket, Key: key, Body: value }).promise()
    },
    [bucket, key, s3],
  )
}

interface MarkdownLoaderProps {
  gated?: boolean
  handle: S3HandleBase
  children: (r: $TSFixMe) => React.ReactNode
  onChange: (value: string) => void
}

function MarkdownLoader({ gated, handle, onChange, children }: MarkdownLoaderProps) {
  const data = utils.useObjectGetter(handle, { noAutoFetch: gated })

  const processed = utils.useProcessing(
    data.result,
    (r: $TSFixMe) => {
      const value = r.Body.toString('utf-8')
      return PreviewData.Editor({ value, onChange })
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
  options: {
    onChange: (value: string) => void
  }
}

export const Loader = function GatedEditorLoader({
  handle,
  children,
  options: { onChange },
}: LoaderProps) {
  const data = utils.useGate(handle)
  const handled = utils.useErrorHandling(data.result, { handle, retry: data.fetch })
  return AsyncResult.case({
    _: children,
    Err: PreviewError.case({
      DoesNotExist: () => children(AsyncResult.Ok(PreviewData.Editor({ onChange }))),
      _: (error: $TSFixMe) => children(AsyncResult.Err(error)),
    }),
    Ok: (gated: boolean) => <MarkdownLoader {...{ gated, handle, children, onChange }} />,
  })(handled)
}
