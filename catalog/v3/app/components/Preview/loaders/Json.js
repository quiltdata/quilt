import * as R from 'ramda'

import AsyncResult from 'utils/AsyncResult'
import * as Resource from 'utils/Resource'

import { PreviewData, PreviewError } from '../types'
import * as Text from './Text'
import * as utils from './utils'

const MAX_SIZE = 1024 * 1024
const SCHEMA_RE = /"\$schema":\s*"https:\/\/vega\.github\.io\/schema\/vega\/(.+)\.json"/

const signVegaSpec = ({ signer, handle }) =>
  R.evolve({
    data: R.map(
      R.evolve({
        url: (url) =>
          signer.signResource({
            ptr: Resource.parse(url),
            ctx: { type: Resource.ContextType.Vega(), handle },
          }),
      }),
    ),
  })

const detectVersion = (txt) => {
  const m = txt.match(SCHEMA_RE)
  return m ? m[1] : false
}

const vegaFetcher = utils.objectGetter((r, { handle, signer }) => {
  try {
    const contents = r.Body.toString('utf-8')
    const spec = JSON.parse(contents)
    return PreviewData.Vega({ spec: signVegaSpec({ signer, handle })(spec) })
  } catch (e) {
    if (e instanceof SyntaxError) {
      throw PreviewError.MalformedJson({ handle, originalError: e })
    }
    throw PreviewError.Unexpected({ handle, originalError: e })
  }
})

const loadVega = (handle, callback) =>
  utils.withSigner((signer) =>
    utils.withS3((s3) => vegaFetcher({ s3, handle, signer }, callback)),
  )

const loadText = (handle, callback) =>
  Text.load(
    handle,
    AsyncResult.case({
      Ok: callback,
      _: callback,
    }),
    { forceLang: 'json' },
  )

export const detect = R.either(utils.extIs('.json'), R.startsWith('.quilt/'))

export const load = utils.withFirstBytes(
  256,
  ({ firstBytes, contentLength, handle }, callback) => {
    const version = detectVersion(firstBytes)
    const vega = !!version && contentLength <= MAX_SIZE
    return (vega ? loadVega : loadText)(handle, callback)
  },
)
