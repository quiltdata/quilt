import { dirname, resolve } from 'path'

import * as R from 'ramda'
import * as React from 'react'

import { getRenderer } from 'components/Markdown'
import type * as Model from 'model'
import * as AWS from 'utils/AWS'
import AsyncResult from 'utils/AsyncResult'
import HljsBoundary from 'utils/HljsBoundary'
import * as NamedRoutes from 'utils/NamedRoutes'
import * as Resource from 'utils/Resource'
import { resolveKey } from 'utils/s3paths'
import useMemoEq from 'utils/useMemoEq'

import { PreviewData, PreviewError } from '../types'
import FileType from './fileType'
import useGate from './useGate'
import * as utils from './utils'

export const FILE_TYPE = FileType.Markdown

type AttributeProcessor = (attr: string) => string

// TODO: resolve relative paths inside packages?
function useImgProcessor(handle: Model.S3.S3ObjectLocation): AttributeProcessor {
  const sign = AWS.Signer.useS3Signer()
  return useMemoEq([sign, handle], () =>
    R.pipe(
      Resource.parse,
      Resource.Pointer.case({
        Web: (url) => url,
        S3: ({ bucket, key, version }) =>
          sign({ bucket: bucket || handle.bucket, key, version }),
        S3Rel: (path) =>
          sign({ bucket: handle.bucket, key: resolveKey(handle.key, path) }),
        Path: (path) =>
          sign({ bucket: handle.bucket, key: resolveKey(handle.key, path) }),
      }),
    ),
  )
}

function useLinkProcessor(handle: Model.S3.S3ObjectLocation): AttributeProcessor {
  const { urls } = NamedRoutes.use()
  const sign = AWS.Signer.useS3Signer()
  return useMemoEq([sign, urls, handle], () =>
    R.pipe(
      Resource.parse,
      Resource.Pointer.case({
        Web: (url) => url,
        S3: ({ bucket, key, version }) =>
          sign({ bucket: bucket || handle.bucket, key, version }),
        S3Rel: (path) =>
          sign({ bucket: handle.bucket, key: resolveKey(handle.key, path) }),
        Path: (p) => {
          const hasSlash = p.endsWith('/')
          const resolved = resolve(dirname(handle.key), p).slice(1)
          const normalized = hasSlash ? `${resolved}/` : resolved
          return hasSlash
            ? urls.bucketDir(handle.bucket, normalized)
            : urls.bucketFile(handle.bucket, normalized)
        },
      }),
    ),
  )
}

// contentsResult: AsyncResult<{ Ok: { contents: string } }>
export function useMarkdownRenderer(
  contentsResult: $TSFixMe,
  handle: Model.S3.S3ObjectLocation,
) {
  const processImg = useImgProcessor(handle)
  const processLink = useLinkProcessor(handle)
  return utils.useProcessing(contentsResult, getRenderer({ processImg, processLink }), [
    processImg,
    processLink,
  ])
}

export const detect = utils.extIn(['.md', '.rmd'])

interface MarkdownLoaderProps {
  gated: boolean
  handle: Model.S3.S3ObjectLocation
  children: (result: $TSFixMe) => React.ReactNode
}

function MarkdownLoader({ gated, handle, children }: MarkdownLoaderProps) {
  const data = utils.useObjectGetter(handle, { noAutoFetch: gated })
  const contents = React.useMemo(
    () =>
      AsyncResult.mapCase({
        Ok: (r: $TSFixMe) => r.Body.toString('utf-8'),
      })(data.result),
    [data.result],
  )
  const markdowned = useMarkdownRenderer(contents, handle)
  const processed = React.useMemo(
    () =>
      AsyncResult.mapCase({
        Ok: (rendered: $TSFixMe) =>
          PreviewData.Markdown({ rendered, modes: [FileType.Markdown, FileType.Text] }),
      })(markdowned),
    [markdowned],
  )
  const handled = utils.useErrorHandling(processed, { handle, retry: data.fetch })
  const result =
    gated && AsyncResult.Init.is(handled)
      ? AsyncResult.Err(PreviewError.Gated({ handle, load: data.fetch }))
      : handled
  return <>{children(result)}</>
}

const SIZE_THRESHOLDS = {
  neverFetch: 3 * 1024 * 1024,
}

interface LoaderProps {
  handle: Model.S3.S3ObjectLocation
  children: (result: $TSFixMe) => React.ReactNode
}

export const Loader = function GatedMarkdownLoader({ handle, children }: LoaderProps) {
  const data = useGate(handle, SIZE_THRESHOLDS)
  const handled = utils.useErrorHandling(data.result, { handle, retry: data.fetch })
  return AsyncResult.case({
    _: children,
    Ok: (gated: $TSFixMe) => (
      <HljsBoundary fallback={children(AsyncResult.Pending())}>
        <MarkdownLoader {...{ gated, handle, children }} />
      </HljsBoundary>
    ),
  })(handled)
}
