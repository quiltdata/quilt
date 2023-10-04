import * as R from 'ramda'
import * as React from 'react'

import type * as Model from 'model'
import * as AWS from 'utils/AWS'
import * as LogicalKeyResolver from 'utils/LogicalKeyResolver'
import * as Resource from 'utils/Resource'
import * as s3paths from 'utils/s3paths'
import type { JsonRecord } from 'utils/types'

import { PreviewError } from '../types'

const createPathResolver = (
  resolveLogicalKey: LogicalKeyResolver.LogicalKeyResolver | null,
  handle: LogicalKeyResolver.S3SummarizeHandle,
): ((path: string) => Promise<LogicalKeyResolver.S3SummarizeHandle>) =>
  resolveLogicalKey && handle.logicalKey
    ? async (path: string) => {
        try {
          return await resolveLogicalKey(
            s3paths.resolveKey(handle.logicalKey as string, path),
          )
        } catch (e) {
          // eslint-disable-next-line no-console
          console.warn(
            `Error resolving data url '${path}' referenced from vega spec at '${handle.logicalKey}'`,
          )
          // eslint-disable-next-line no-console
          console.error(e)
          throw PreviewError.SrcDoesNotExist({ path })
        }
      }
    : (path: string) =>
        Promise.resolve({
          bucket: handle.bucket,
          key: s3paths.resolveKey(handle.key, path),
        })

const createUrlProcessor = (
  sign: (handle: Model.S3.S3ObjectLocation) => string,
  resolvePath: (path: string) => Promise<Model.S3.S3ObjectLocation>,
) =>
  R.pipe(
    Resource.parse,
    Resource.Pointer.case({
      Web: async (url) => url,
      S3: async (h) => sign(h),
      S3Rel: async (path) => sign(await resolvePath(path)),
      Path: async (path) => sign(await resolvePath(path)),
    }),
  )

const createObjectUrlsSigner =
  (
    traverseUrls: (fn: (v: any) => any, json: JsonRecord) => JsonRecord,
    processUrl: (path: string) => Promise<string>,
  ) =>
  async (json: JsonRecord) => {
    const promises: Promise<string>[] = []
    const jsonWithPlaceholders = traverseUrls((url: string): number => {
      const len = promises.push(processUrl(url))
      return len - 1
    }, json)
    const results = await Promise.all(promises)
    return traverseUrls((idx: number): string => results[idx], jsonWithPlaceholders)
  }

export default function useSignObjectUrls(
  handle: LogicalKeyResolver.S3SummarizeHandle,
  traverseUrls: (fn: (v: any) => any, json: JsonRecord) => JsonRecord,
) {
  const resolveLogicalKey = LogicalKeyResolver.use()
  // @ts-expect-error
  const sign = AWS.Signer.useS3Signer({ forceProxy: true })
  const resolvePath = React.useMemo(
    () => createPathResolver(resolveLogicalKey, handle),
    [resolveLogicalKey, handle],
  )
  const processUrl = React.useMemo(
    () => createUrlProcessor(sign, resolvePath),
    [sign, resolvePath],
  )
  return React.useMemo(
    () => createObjectUrlsSigner(traverseUrls, processUrl),
    [traverseUrls, processUrl],
  )
}
