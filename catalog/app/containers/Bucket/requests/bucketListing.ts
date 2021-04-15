import type { S3 } from 'aws-sdk'
import * as React from 'react'
import * as R from 'ramda'

import * as AWS from 'utils/AWS'

import * as errors from '../errors'

import { decodeS3Key } from './utils'

export interface BucketListingFile {
  bucket: string
  key: string
  modified: Date
  size: number
  etag: string
  archived: boolean
}

export interface BucketListingResult {
  dirs: string[]
  files: BucketListingFile[]
  truncated: boolean
  continuationToken?: string
  bucket: string
  path: string
  prefix?: string
}

interface BucketListingDependencies {
  s3: S3
}

interface BucketListingParams {
  bucket: string
  path?: string
  prefix?: string
  prev?: BucketListingResult
  delimiter?: string | false
}

// TODO: support draining
export const bucketListing = ({
  s3,
  bucket,
  path = '',
  prefix,
  prev,
  delimiter = '/',
}: BucketListingParams & BucketListingDependencies): Promise<BucketListingResult> =>
  s3
    .listObjectsV2({
      Bucket: bucket,
      Delimiter: delimiter === false ? undefined : delimiter,
      Prefix: path + (prefix || ''),
      EncodingType: 'url',
      ContinuationToken: prev ? prev.continuationToken : undefined,
    })
    .promise()
    .then((res) => {
      let dirs = (res.CommonPrefixes || [])
        .map((p) => decodeS3Key(p.Prefix!))
        .filter((d) => d !== '/' && d !== '../')
      if (prev && prev.dirs) dirs = prev.dirs.concat(dirs)
      dirs = R.uniq(dirs)

      let files = (res.Contents || [])
        .map(R.evolve({ Key: decodeS3Key }))
        // filter-out "directory-files" (files that match prefixes)
        .filter(({ Key }: S3.Object) => Key !== path && !Key!.endsWith('/'))
        .map((i: S3.Object) => ({
          bucket,
          key: i.Key!,
          modified: i.LastModified!,
          size: i.Size!,
          etag: i.ETag!,
          archived: i.StorageClass === 'GLACIER' || i.StorageClass === 'DEEP_ARCHIVE',
        }))
      if (prev && prev.files) files = prev.files.concat(files)

      return {
        dirs,
        files,
        truncated: res.IsTruncated!,
        continuationToken: res.NextContinuationToken,
        bucket,
        path,
        prefix,
      }
    })
    .catch(errors.catchErrors())

export function useBucketListing() {
  const s3: S3 = AWS.S3.use()
  return React.useCallback(
    (params: BucketListingParams) => bucketListing({ s3, ...params }),
    [s3],
  )
}
