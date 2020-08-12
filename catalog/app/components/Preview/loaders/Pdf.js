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
  try {
    const url = sign(handle)
    const search = mkSearch({
      url,
      input: 'pdf',
      output: 'raw',
      size: 'w1024h768',
      countPages: true,
    })
    const r = await fetch(`${endpoint}/thumbnail${search}`)
    if (r.status >= 400) {
      const text = await r.text()
      throw new HTTPError(r, text)
    }
    const { page_count: pages } = JSON.parse(r.headers.get('X-Quilt-Info') || '{}')
    const firstPageBlob = await r.blob()
    return AsyncResult.Ok(PreviewData.Pdf({ handle, pages, firstPageBlob }))
  } catch (e) {
    console.warn('error loading pdf preview')
    console.error(e)
    throw PreviewError.Unexpected({ handle, originalError: e })
  }
}

function PdfLoader({ handle, callback }) {
  const endpoint = Config.use().binaryApiGatewayEndpoint
  const sign = AWS.Signer.useS3Signer()
  const data = Data.use(loadPdf, { endpoint, sign, handle })
  return callback(data.result, { fetch: data.fetch })
}

export const load = (handle, callback) => <PdfLoader {...{ handle, callback }} />
