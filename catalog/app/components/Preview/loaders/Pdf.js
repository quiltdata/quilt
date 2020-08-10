import * as React from 'react'

import { HTTPError } from 'utils/APIConnector'
import * as AWS from 'utils/AWS'
import AsyncResult from 'utils/AsyncResult'
import * as Config from 'utils/Config'
import * as Data from 'utils/Data'
import { mkSearch } from 'utils/NamedRoutes'

import { PreviewData, PreviewError } from '../types'
import * as utils from './utils'

export const detect = utils.extIs('.pdf')

async function loadPdf({ endpoint, sign, handle }) {
  console.log('loadPdf', { endpoint, handle })
  try {
    const url = sign(handle)
    const search = mkSearch({
      url,
      input: 'pdf',
      output: 'raw',
      size: 'w1024h768',
      // countPages: true,
    })
    const r = await fetch(`${endpoint}/thumbnail${search}`)
    console.log('loadPdf resp', r)
    if (r.status >= 400) {
      const text = await r.text()
      throw new HTTPError(r, text)
    }
    // get X-Quilt-Info header and parse it
    // r.headers['X-Quilt-Info']
    const size = 'tbd'
    const pages = 10
    const firstPageBlob = await r.blob()
    return AsyncResult.Ok(PreviewData.Pdf({ handle, pages, firstPageBlob, size }))
  } catch (e) {
    console.warn('error loading pdf preview')
    console.error(e)
    // TODO: handle err
    // if (HTTPError.is(e /*, status, msg*/)) {
    // }
    // PreviewError.DoesNotExist
    throw PreviewError.Unexpected({ handle, originalError: e })
  }
}

function PdfLoader({ handle, extra, children }) {
  console.log('PdfLoader', { handle, extra })
  const endpoint = Config.use().binaryApiGatewayEndpoint
  const sign = AWS.Signer.useS3Signer()
  const data = Data.use(loadPdf, { endpoint, sign, handle })
  return children(data.result, { fetch: data.fetch })
}

export const load = (handle, callback, extra) => (
  <PdfLoader handle={handle} extra={extra}>
    {callback}
  </PdfLoader>
)
