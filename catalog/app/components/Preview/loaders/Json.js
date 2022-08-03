import hljs from 'highlight.js'
import * as R from 'ramda'
import * as React from 'react'

import AsyncResult from 'utils/AsyncResult'

import { PreviewData, PreviewError } from '../types'
import * as IgvLoader from './Igv'
import useSignObjectUrls from './useSignObjectUrls'

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

const detectSchema = (txt) => {
  const m = txt.match(SCHEMA_RE)
  if (!m) return false
  const [, library, version] = m
  if (library !== 'vega' && library !== 'vega-lite') return false
  return { library, version }
}

function VegaLoader({ handle, gated, children }) {
  const signSpec = useSignObjectUrls(handle, traverseUrls)
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

function findLoader(mode, firstBytes) {
  switch (mode) {
    case 'json':
      return JsonLoader
    case 'igv':
      return IgvLoader.Loader
    default:
      return detectSchema(firstBytes) ? VegaLoader : JsonLoader
  }
}

export const Loader = function GatedJsonLoader({ handle, children, options }) {
  return utils.useFirstBytes({ bytes: BYTES_TO_SCAN, handle }).case({
    Ok: ({ firstBytes, contentLength }) => {
      const LoaderComponent = findLoader(options.mode, firstBytes)
      return (
        <LoaderComponent {...{ handle, children, gated: contentLength > MAX_SIZE }} />
      )
    },
    _: children,
  })
}
