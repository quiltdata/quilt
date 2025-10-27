import { join, relative, basename } from 'path'

import type { S3 } from 'aws-sdk'
import pLimit from 'p-limit'
import * as React from 'react'
import * as R from 'ramda'

import type * as Model from 'model'
import * as AWS from 'utils/AWS'
import * as s3paths from 'utils/s3paths'

import * as errors from '../errors'

import { decodeS3Key } from './utils'

const DEFAULT_DRAIN_REQUESTS = 10

interface DrainObjectListParams {
  s3: S3
  bucket: string
  prefix: string
  delimiter?: string
  continuationToken?: string
  maxRequests: number
  maxKeys?: number
}

const drainObjectList = async ({
  s3,
  bucket,
  prefix,
  delimiter,
  continuationToken,
  maxRequests,
  maxKeys,
}: DrainObjectListParams) => {
  let reqNo = 0
  let Contents: S3.Object[] = []
  let CommonPrefixes: S3.CommonPrefixList = []
  let ContinuationToken: string | undefined
  // eslint-disable-next-line no-constant-condition
  while (true) {
    // eslint-disable-next-line no-await-in-loop
    const r = await s3
      .listObjectsV2({
        Bucket: bucket,
        Delimiter: delimiter,
        Prefix: prefix,
        ContinuationToken: ContinuationToken || continuationToken,
        EncodingType: 'url',
        MaxKeys: maxKeys,
      })
      .promise()
    Contents = Contents.concat(r.Contents || [])
    CommonPrefixes = CommonPrefixes.concat(r.CommonPrefixes || [])
    reqNo += 1
    if (!r.IsTruncated || reqNo >= maxRequests) return { ...r, Contents, CommonPrefixes }
    ContinuationToken = r.NextContinuationToken
  }
}

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
  drain?: true | number
  maxKeys?: number
}

export const bucketListing = async ({
  s3,
  bucket,
  path = '',
  prefix,
  prev,
  delimiter = '/',
  drain = 0,
  maxKeys = undefined,
}: BucketListingParams & BucketListingDependencies): Promise<BucketListingResult> =>
  drainObjectList({
    s3,
    bucket,
    prefix: path + (prefix || ''),
    delimiter: delimiter === false ? undefined : delimiter,
    continuationToken: prev ? prev.continuationToken : undefined,
    maxRequests: drain === true ? DEFAULT_DRAIN_REQUESTS : drain,
    maxKeys,
  })
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

// TODO: add entry with size from <Listing /> but try to re-use existing types
function useHeadFile() {
  const s3: S3 = AWS.S3.use()
  return React.useCallback(
    async ({
      bucket,
      key,
      version,
    }: Model.S3.S3ObjectLocation): Promise<Model.S3File> => {
      const { ContentLength: size } = await s3
        .headObject({ Bucket: bucket, Key: key, VersionId: version })
        .promise()
      return { bucket, key, size: size || 0, version }
    },
    [s3],
  )
}

type LogicalKey = string
type PhysicalKey = string

function useResolveFile() {
  const headFile = useHeadFile()
  return React.useCallback(
    async (handle: Model.S3.S3ObjectLocation, logicalKey?: LogicalKey) => {
      const result = await headFile(handle)
      return { [logicalKey || basename(result.key)]: result }
    },
    [headFile],
  )
}

function useResolveDirectory() {
  const requestbucketListing = useBucketListing()
  return React.useCallback(
    async (handle: Model.S3.S3ObjectLocation, prefix?: LogicalKey) => {
      const result = await requestbucketListing({
        bucket: handle.bucket,
        path: handle.key,
        delimiter: false,
        drain: true,
      })
      const pairs = result.files.map((file) => [
        prefix
          ? join(prefix, relative(result.path, file.key))
          : relative(join(result.path, '..'), file.key),
        file,
      ])
      return Object.fromEntries(pairs as [LogicalKey, Model.S3File][])
    },
    [requestbucketListing],
  )
}

function useResolveHandlesMap() {
  const resolveFile = useResolveFile()
  const resolveDirectory = useResolveDirectory()
  return React.useCallback(
    (handlesMap: Record<LogicalKey, PhysicalKey>) =>
      Object.entries(handlesMap).map(([logicalKey, physicalKey]) => {
        const handle = s3paths.parseS3Url(physicalKey)
        return s3paths.isDir(handle.key)
          ? limit(resolveDirectory, handle, logicalKey)
          : limit(resolveFile, handle, logicalKey)
      }),
    [resolveFile, resolveDirectory],
  )
}

function useResolveHandles() {
  const resolveFile = useResolveFile()
  const resolveDirectory = useResolveDirectory()
  return React.useCallback(
    (handles: Model.S3.S3ObjectLocation[]) =>
      handles.map((handle) =>
        s3paths.isDir(handle.key)
          ? limit(resolveDirectory, handle)
          : limit(resolveFile, handle),
      ),
    [resolveFile, resolveDirectory],
  )
}

const mergeRecords = <L, R>(
  left?: Record<PropertyKey, L>,
  right?: Record<PropertyKey, R>,
) => ({ ...left, ...right })

const limit = pLimit(5)

export function useFilesListing() {
  const resolveHandles = useResolveHandles()
  const resolveHandlesMap = useResolveHandlesMap()
  return React.useCallback(
    async (handles: Model.S3.S3ObjectLocation[] | Record<LogicalKey, PhysicalKey>) => {
      const requests = Array.isArray(handles)
        ? resolveHandles(handles)
        : resolveHandlesMap(handles)
      const records = await Promise.all(requests)
      return records.reduce(mergeRecords, {})
    },
    [resolveHandles, resolveHandlesMap],
  )
}
