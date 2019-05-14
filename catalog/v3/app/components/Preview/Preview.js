import AsyncResult from 'utils/AsyncResult'

import * as loaders from './loaders'
import * as renderers from './renderers'
import { PreviewData, PreviewError } from './types'

export { PreviewData, PreviewError }

const fallback = {
  detect: () => true,
  load: (handle, callback) =>
    callback(AsyncResult.Err(PreviewError.Unsupported({ handle }))),
}

const loaderChain = [
  loaders.Excel,
  loaders.Json,
  loaders.Markdown,
  loaders.Notebook,
  loaders.Parquet,
  loaders.Vcf,
  loaders.Text,
  loaders.Image,
  fallback,
]

const chooseLoader = (key) => loaderChain.find((L) => L.detect(key))

export const load = (handle, callback) => chooseLoader(handle.key).load(handle, callback)

export const render = PreviewData.case(renderers)
