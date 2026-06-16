import * as React from 'react'

import * as AWS from 'utils/AWS'
import * as GQL from 'utils/GraphQL'

import * as Summarize from '../../Summarize'

import BUCKET_QUERY from '../gql/Bucket.generated'
import SectionTitle from './SectionTitle'

// Auto-discovered summaries (no quilt_summarize.json) are laid out as a grid of
// this many columns per row; user-authored quilt_summarize.json layouts are
// rendered as authored.
const GRID_PER_ROW = 2

interface SummariesProps {
  bucket: string
}

export default function Summaries({ bucket }: SummariesProps) {
  const s3 = AWS.S3.use()
  const { bucket: bucketData } = GQL.useQueryS(BUCKET_QUERY, { bucket })
  const inStack = !!bucketData
  return (
    <Summarize.SummaryRoot
      s3={s3}
      bucket={bucket}
      inStack={inStack}
      gridFallbackPerRow={GRID_PER_ROW}
      title={<SectionTitle>Files</SectionTitle>}
    />
  )
}
