import { dirname, resolve } from 'path'

import * as R from 'ramda'
import * as React from 'react'

import { getRenderer } from 'components/Markdown'
import * as AWS from 'utils/AWS'
import AsyncResult from 'utils/AsyncResult'
import * as NamedRoutes from 'utils/NamedRoutes'
import * as Resource from 'utils/Resource'
import pipeThru from 'utils/pipeThru'
import { resolveKey } from 'utils/s3paths'
import useMemoEq from 'utils/useMemoEq'

import { PreviewData, PreviewError } from '../types'
import FileType from './fileType'
import useGate from './useGate'
import * as utils from './utils'

export const FILE_TYPE = FileType.Markdown

// TODO: resolve relative paths inside packages?
// this will require async processing and remarkable@1 doesnt support that,
// so we either come up with some workaround or migrate to remarkable@2 or some other markdown renderer
// (probably the one that will output react instead of html string).
function useImgProcessor(handle) {
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

function useLinkProcessor(handle) {
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

export const detect = utils.extIn(['.md', '.rmd'])

function MarkdownLoader({ gated, handle, children }) {
  const processImg = useImgProcessor(handle)
  const processLink = useLinkProcessor(handle)
  const data = utils.useObjectGetter(handle, { noAutoFetch: gated })
  const processed = utils.useProcessing(
    data.result,
    (r) => {
      const contents = r.Body.toString('utf-8')
      const rendered = getRenderer({ processImg, processLink })(contents)
      return PreviewData.Markdown({ rendered, modes: [FileType.Markdown, FileType.Text] })
    },
    [processImg, processLink],
  )
  const handled = utils.useErrorHandling(processed, { handle, retry: data.fetch })
  const result =
    gated && AsyncResult.Init.is(handled)
      ? AsyncResult.Err(PreviewError.Gated({ handle, load: data.fetch }))
      : handled
  return children(result)
}

const SIZE_THRESHOLDS = {
  neverFetch: 3 * 1024 * 1024,
}

export const Loader = function GatedMarkdownLoader({ handle, children }) {
  const data = useGate(handle, SIZE_THRESHOLDS)
  const handled = utils.useErrorHandling(data.result, { handle, retry: data.fetch })
  return pipeThru(handled)(
    AsyncResult.case({
      _: children,
      Ok: (gated) => <MarkdownLoader {...{ gated, handle, children }} />,
    }),
  )
}
