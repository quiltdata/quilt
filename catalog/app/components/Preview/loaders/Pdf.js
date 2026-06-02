import cfg from 'constants/config'
import { HTTPError } from 'utils/APIConnector'
import * as AWS from 'utils/AWS'
import * as Data from 'utils/Data'
import { mkSearch } from 'utils/NamedRoutes'
import useMemoEq from 'utils/useMemoEq'

import { PreviewData, PreviewError } from '../types'
import * as utils from './utils'

export const detect = utils.extIn(['.pdf', '.pptx'])

async function loadPdf({ url, handle }) {
  try {
    const type = (handle.logicalKey || handle.key).toLowerCase().endsWith('.pptx')
      ? 'pptx'
      : 'pdf'
    const search = mkSearch({
      url,
      input: type,
      size: 'w2048h1536',
      countPages: true,
    })
    const r = await fetch(`${cfg.apiGatewayEndpoint}/thumbnail${search}`)
    if (r.status >= 400) {
      const text = await r.text()
      throw new HTTPError(r, text)
    }
    const { page_count: pages } = JSON.parse(r.headers.get('X-Quilt-Info') || '{}')
    const firstPageBlob = await r.blob()
    return PreviewData.Pdf({ handle, pages, firstPageBlob, type })
  } catch (e) {
    if (e instanceof HTTPError && e.json && e.json.error === 'Forbidden') {
      if (e.json.text && e.json.text.match(utils.GLACIER_ERROR_RE)) {
        throw PreviewError.Archived({ handle })
      }
      throw PreviewError.Forbidden({ handle })
    }
    // eslint-disable-next-line no-console
    console.warn('error loading pdf preview', { ...e })
    // eslint-disable-next-line no-console
    console.error(e)
    throw PreviewError.Unexpected({
      handle,
      retry: null,
      message: e.message || String(e),
      originalError: e,
    })
  }
}

export const Loader = function PdfLoader({ handle, children }) {
  const sign = AWS.Signer.useS3Signer()
  const url = useMemoEq([sign, handle.bucket, handle.key, handle.version], () =>
    sign(handle),
  )
  const data = Data.use(loadPdf, { url, handle })
  return children(utils.useErrorHandling(data.result, { handle, retry: data.fetch }))
}
