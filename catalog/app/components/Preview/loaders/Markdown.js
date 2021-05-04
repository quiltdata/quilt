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
import * as utils from './utils'

// TODO: resolve relative paths inside packages?
// this will require async processing and remarkable@1 doesnt support that,
// so we either come up with some workaround or migrate to remarkable@2 or some other markdown renderer
// (probably the one that will output react instead of html string).
function useImgProcessor(handle) {
  const sign = AWS.Signer.useS3Signer()
  return useMemoEq([sign, handle], () =>
    R.evolve({
      src: R.pipe(
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
    }),
  )
}

function useLinkProcessor(handle) {
  const { urls } = NamedRoutes.use()
  const sign = AWS.Signer.useS3Signer()
  return useMemoEq([sign, urls, handle], () =>
    R.evolve({
      href: R.pipe(
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
    }),
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
      const rendered = getRenderer({ images: true, processImg, processLink })(contents)
      return PreviewData.Markdown({ rendered })
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

export const Loader = function GatedMarkdownLoader({ handle, children }) {
  const data = utils.useGate(handle)
  const handled = utils.useErrorHandling(data.result, { handle, retry: data.fetch })
  return pipeThru(handled)(
    AsyncResult.case({
      _: children,
      Ok: (gated) => <MarkdownLoader {...{ gated, handle, children }} />,
    }),
  )
}
