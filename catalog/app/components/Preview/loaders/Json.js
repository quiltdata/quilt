import * as R from 'ramda'
import * as React from 'react'

import * as AWS from 'utils/AWS'
import AsyncResult from 'utils/AsyncResult'
import * as Resource from 'utils/Resource'

import { PreviewData, PreviewError } from '../types'
import * as Text from './Text'
import * as utils from './utils'

const MAX_SIZE = 20 * 1024 * 1024
const SCHEMA_RE = /"\$schema":\s*"https:\/\/vega\.github\.io\/schema\/([\w-]+)\/([\w.-]+)\.json"/

const map = (fn) => R.ifElse(Array.isArray, R.map(fn), fn)

function useVegaSpecSigner(handle) {
  const sign = AWS.Signer.useResourceSigner()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return React.useCallback(
    R.evolve({
      data: map(
        R.evolve({
          url: (url) =>
            sign({
              ptr: Resource.parse(url),
              ctx: { type: Resource.ContextType.Vega(), handle },
            }),
        }),
      ),
    }),
    [sign, handle],
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
  const processed = utils.useProcessing(
    data.result,
    (r) => {
      try {
        const contents = r.Body.toString('utf-8')
        const spec = JSON.parse(contents)
        return PreviewData.Vega({ spec: signSpec(spec) })
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

export const detect = R.either(utils.extIs('.json'), R.startsWith('.quilt/'))

export const Loader = function JsonLoader({ handle, children }) {
  return utils.useFirstBytes({ bytes: 256, handle }).case({
    Ok: ({ firstBytes, contentLength }) =>
      detectSchema(firstBytes) ? (
        <VegaLoader {...{ handle, children, gated: contentLength > MAX_SIZE }} />
      ) : (
        <Text.Loader {...{ handle, children, forceLang: 'json' }} />
      ),
    _: children,
  })
}
