import * as React from 'react'

import * as AWS from 'utils/AWS'
import * as GQL from 'utils/GraphQL'

import * as Summarize from '../../Summarize'

import BUCKET_QUERY from '../gql/Bucket.generated'

interface SummariesProps {
  bucket: string
}

export default function Summaries({ bucket }: SummariesProps) {
  const s3 = AWS.S3.use()
  const { bucket: bucketData } = GQL.useQueryS(BUCKET_QUERY, { bucket })
  const inStack = !!bucketData
  // Only user-authored quilt_summarize.json layouts belong on the bucket
  // Overview; auto-discovered file previews read as context-less chart noise
  // and are demoted to the package page.
  return (
    <Summarize.SummaryRoot s3={s3} bucket={bucket} inStack={inStack} quiltSummarizeOnly />
  )
}
