import hljs from 'highlight.js'
import * as R from 'ramda'
import * as React from 'react'

import * as AWS from 'utils/AWS'
import AsyncResult from 'utils/AsyncResult'
import { useLogicalKeyResolver } from 'utils/LogicalKeyResolver'
import * as Resource from 'utils/Resource'
import * as s3paths from 'utils/s3paths'

import { PreviewData, PreviewError } from '../types'

import * as Text from './Text'
import * as utils from './utils'

const MAX_SIZE = 20 * 1024 * 1024
const SCHEMA_RE =
  /"\$schema":\s*"https:\/\/vega\.github\.io\/schema\/([\w-]+)\/([\w.-]+)\.json"/
const BYTES_TO_SCAN = 128 * 1024

const map = (fn) => R.ifElse(Array.isArray, R.map(fn), fn)

export const traverseUrls = (fn, spec) =>
  R.evolve(
    {
      data: map(R.evolve({ url: fn })),
      layer: map((l) => traverseUrls(fn, l)),
    },
    spec,
  )

// NOTE: downloads content from urls embeded in `{ data: url-here-becomes-json }`
function useVegaSpecSigner(handle) {
  const sign = AWS.Signer.useS3Signer({ forceProxy: true })
  const resolveLogicalKey = useLogicalKeyResolver()

  const resolvePath = React.useMemo(
    () =>
      resolveLogicalKey && handle.logicalKey
        ? (path) =>
            resolveLogicalKey(s3paths.resolveKey(handle.logicalKey, path)).catch((e) => {
              // eslint-disable-next-line no-console
              console.warn(
                `Error resolving data url '${path}' referenced from vega spec at '${handle.logicalKey}'`,
              )
              // eslint-disable-next-line no-console
              console.error(e)
              throw PreviewError.SrcDoesNotExist({ path })
            })
        : (path) => ({
            bucket: handle.bucket,
            key: s3paths.resolveKey(handle.key, path),
          }),
    [resolveLogicalKey, handle.logicalKey, handle.key, handle.bucket],
  )

  const processUrl = React.useMemo(
    () =>
      R.pipe(
        Resource.parse,
        Resource.Pointer.case({
          Web: async (url) => url,
          S3: async (h) => sign(h),
          S3Rel: async (path) => sign(await resolvePath(path)),
          Path: async (path) => sign(await resolvePath(path)),
        }),
      ),
    [sign, resolvePath],
  )

  return React.useCallback(
    async (spec) => {
      const promises = []
      const specWithPlaceholders = traverseUrls((url) => {
        const len = promises.push(processUrl(url))
        return len - 1
      }, spec)
      const results = await Promise.all(promises)
      return traverseUrls((idx) => results[idx], specWithPlaceholders)
    },
    [processUrl],
  )
}

const detectSchema = (txt) => {
  const m = txt.match(SCHEMA_RE)
  if (!m) return false
  const [, library, version] = m
  if (library !== 'vega' && library !== 'vega-lite') return false
  return { library, version }
}

function VegaLoader({ handle, gated, children }) {
  const signSpec = useVegaSpecSigner(handle)
  const data = utils.useObjectGetter(handle, { noAutoFetch: gated })
  const processed = utils.useAsyncProcessing(
    data.result,
    async (r) => {
      try {
        const contents = r.Body.toString('utf-8')
        const spec = JSON.parse(contents)
        return PreviewData.Vega({ spec: await signSpec(spec) })
      } catch (e) {
        if (e instanceof SyntaxError) {
          throw PreviewError.MalformedJson({ handle, message: e.message })
        }
        throw e
      }
    },
    [signSpec, handle],
  )
  const handled = utils.useErrorHandling(processed, { handle, retry: data.fetch })
  const result =
    gated && AsyncResult.Init.is(handled)
      ? AsyncResult.Err(PreviewError.Gated({ handle, load: data.fetch }))
      : handled
  return children(result)
}

const hl = (language) => (contents) => hljs.highlight(contents, { language }).value

function JsonLoader({ gated, handle, children }) {
  const { result, fetch } = utils.usePreview({
    type: 'txt',
    handle,
    query: { max_bytes: Text.MAX_BYTES },
  })
  const processed = utils.useProcessing(
    result,
    ({ info: { data, note, warnings } }) => {
      const head = data.head.join('\n')
      const tail = data.tail.join('\n')
      try {
        const rendered = JSON.parse([head, tail].join('\n'))
        return PreviewData.Json({ rendered })
      } catch (e) {
        if (e instanceof SyntaxError) {
          const lang = 'json'
          const highlighted = R.map(hl(lang), { head, tail })
          return PreviewData.Text({
            head,
            tail,
            lang,
            highlighted,
            note,
            warnings,
          })
        }
        throw e
      }
    },
    [],
  )
  const handled = utils.useErrorHandling(processed, { handle, retry: fetch })
  return children(
    gated && AsyncResult.Init.is(handled)
      ? AsyncResult.Err(PreviewError.Gated({ handle, load: fetch }))
      : handled,
  )
}

export const detect = R.either(utils.extIs('.json'), R.startsWith('.quilt/'))

export const Loader = function GatedJsonLoader({ handle, children }) {
  return utils.useFirstBytes({ bytes: BYTES_TO_SCAN, handle }).case({
    Ok: ({ firstBytes, contentLength }) =>
      detectSchema(firstBytes) && handle.mode !== 'json' ? (
        <VegaLoader {...{ handle, children, gated: contentLength > MAX_SIZE }} />
      ) : (
        <JsonLoader {...{ handle, children, gated: contentLength > MAX_SIZE }} />
      ),
    _: children,
  })
}
