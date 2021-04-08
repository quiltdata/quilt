import type { S3 } from 'aws-sdk'
import * as R from 'ramda'

import * as errors from '../errors'

import { decodeS3Key } from './utils'

interface File {
  bucket: string
  key: string
  modified: Date
  size: number
  etag: string
  archived: boolean
}

export interface BucketListingResult {
  dirs: string[]
  files: File[]
  truncated: boolean
  continuationToken?: string
  bucket: string
  path: string
  prefix?: string
}

interface BucketListingParams {
  s3: S3
  bucket: string
  path?: string
  prefix?: string
  prev?: BucketListingResult
}

export const bucketListing = ({
  s3,
  bucket,
  path = '',
  prefix,
  prev,
}: BucketListingParams): Promise<BucketListingResult> =>
  s3
    .listObjectsV2({
      Bucket: bucket,
      Delimiter: '/',
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
          // TODO: expose VersionId?
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
