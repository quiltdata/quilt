import * as React from 'react'

import * as AWS from 'utils/AWS'
import type * as S3Tags from 'utils/s3Tags'
import * as Request from 'utils/useRequest'

import * as requests from '../../requests'

/** `null` until loaded and when the bucket has no `.quilt/s3_tags.yml` */
export type S3TagsConfigState = S3Tags.S3TagsConfig | null | Error

export function useS3TagsConfig(
  open: boolean,
  bucket: string,
): { config: S3TagsConfigState; loading: boolean } {
  const s3 = AWS.S3.use()
  const req = React.useCallback(() => requests.s3TagsConfig({ s3, bucket }), [bucket, s3])
  const result = Request.use(req, open)
  if (result === Request.Idle) return { config: null, loading: false }
  if (result === Request.Loading) return { config: null, loading: true }
  // A broken config doesn't block pushing: the preview shows the error and no tags are written.
  return { config: result, loading: false }
}
