import * as R from 'ramda'
import * as React from 'react'

import AsyncResult from 'utils/AsyncResult'
import type { S3HandleBase } from 'utils/s3paths'
import type { JsonRecord } from 'utils/types'

import { PreviewData, PreviewError } from '../types'

import useSignObjectUrls from './useSignObjectUrls'
import * as utils from './utils'

export const MODE = 'vega'

const SCHEMA_RE =
  /"\$schema":\s*"https:\/\/vega\.github\.io\/schema\/([\w-]+)\/([\w.-]+)\.json"/
export const detectSchema = (txt: string) => {
  const m = txt.match(SCHEMA_RE)
  if (!m) return false
  const [, library, version] = m
  if (library !== 'vega' && library !== 'vega-lite') return false
  return { library, version }
}

const map: $TSFixMe = (fn: (x: unknown) => unknown) =>
  R.ifElse(Array.isArray, R.map(fn), fn)

export const traverseUrls: $TSFixMe = (fn: (u: unknown) => unknown, spec: JsonRecord) =>
  R.evolve(
    {
      data: map(R.evolve({ url: fn })),
      layer: map((l: $TSFixMe) => traverseUrls(fn, l)),
    },
    spec,
  )

interface VegaLoaderProps {
  children: (result: $TSFixMe) => React.ReactNode
  gated: boolean
  handle: S3HandleBase
}

export const Loader = function VegaLoader({ handle, gated, children }: VegaLoaderProps) {
  const signSpec = useSignObjectUrls(handle, traverseUrls)
  const data = utils.useObjectGetter(handle, { noAutoFetch: gated })
  const processed = utils.useAsyncProcessing(
    data.result,
    async (r: { Body: Buffer }) => {
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
