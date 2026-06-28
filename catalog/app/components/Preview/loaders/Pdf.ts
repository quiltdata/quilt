import type * as React from 'react'

import cfg from 'constants/config'
import { HTTPError } from 'utils/APIConnector'
import * as AWS from 'utils/AWS'
import * as Data from 'utils/Data'
import { S3SummarizeHandle } from 'utils/LogicalKeyResolver'
import { mkSearch } from 'utils/NamedRoutes'

import { PreviewData, PreviewError } from '../types'
import * as utils from './utils'

export const detect = utils.extIn(['.pdf', '.pptx'])

interface LoadPdfArgs {
  sign: (handle: S3SummarizeHandle) => string
  handle: S3SummarizeHandle
}

async function loadPdf({ sign, handle }: LoadPdfArgs) {
  try {
    const url = sign(handle)
    const type = (handle.logicalKey || handle.key).toLowerCase().endsWith('.pptx')
      ? 'pptx'
      : 'pdf'
    const search = mkSearch({
      url,
      input: type,
      size: 'w1024h768',
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
  } catch (e: $TSFixMe) {
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
    throw e
  }
}

interface PdfLoaderProps {
  handle: S3SummarizeHandle
  children: (result: $TSFixMe) => React.ReactNode
}

export const Loader = function PdfLoader({ handle, children }: PdfLoaderProps) {
  const sign = AWS.Signer.useS3Signer()
  const data = Data.use(loadPdf, { sign, handle })
  return children(utils.useErrorHandling(data.result, { handle, retry: data.fetch }))
}
