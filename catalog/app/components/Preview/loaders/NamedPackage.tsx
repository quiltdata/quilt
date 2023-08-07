import * as R from 'ramda'
import type * as React from 'react'

import type * as Model from 'model'

import { PreviewData } from '../types'
import * as utils from './utils'

export const MAX_BYTES = 10 * 1024

export const detect = R.startsWith('.quilt/named_packages/')

interface PreviewResult {
  info: {
    data: {
      head: string[]
      tail: string[]
    }
    note?: string
    warnings?: string
  }
}

interface LoaderProps {
  handle: Model.S3.S3ObjectLocation
  children: (result: $TSFixMe) => React.ReactNode
}

export const Loader = function NamedPackageLoader({ handle, children }: LoaderProps) {
  const { result, fetch } = utils.usePreview({
    type: 'txt',
    handle,
    query: { max_bytes: MAX_BYTES },
  })
  const processed = utils.useProcessing(
    result,
    ({ info: { data, note, warnings } }: PreviewResult) => {
      const hash = [...data.head, ...data.tail].join('')
      return PreviewData.NamedPackage({ bucket: handle.bucket, hash, note, warnings })
    },
    [handle.bucket],
  )
  return children(utils.useErrorHandling(processed, { handle, retry: fetch }))
}
