import type * as React from 'react'

import type { S3HandleBase } from 'utils/s3paths'

import { ParquetMetadata } from '../../loaders/Tabular'

export interface PerspectiveProps extends React.HTMLAttributes<HTMLDivElement> {
  context: 'file' | 'listing'
  data: string | ArrayBuffer
  meta: ParquetMetadata
  handle: S3HandleBase
  onLoadMore: () => void
  truncated: boolean
}
