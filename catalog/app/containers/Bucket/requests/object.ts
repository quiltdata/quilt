import type { S3 } from 'aws-sdk'
import * as R from 'ramda'
import * as React from 'react'

import type * as Model from 'model'
import * as AWS from 'utils/AWS'
import { useData } from 'utils/Data'
import type { JsonRecord } from 'utils/types'

interface ObjectTagsArgs {
  s3: S3
  handle: Model.S3.S3ObjectLocation
}

export type ObjectTags = Record<string, string>[]

export const objectTags = ({
  s3,
  handle: { bucket, key, version },
}: ObjectTagsArgs): Promise<ObjectTags | undefined> =>
  s3
    .getObjectTagging({
      Bucket: bucket,
      Key: key,
      VersionId: version,
    })
    .promise()
    .then(({ TagSet }) => TagSet.map(({ Key, Value }) => ({ [Key]: Value })))
    .then((tags) => (tags.length ? tags : undefined))

interface ObjectMetaArgs {
  s3: S3
  handle: Model.S3.S3ObjectLocation
}

export const objectMeta = ({
  s3,
  handle: { bucket, key, version },
}: ObjectMetaArgs): Promise<JsonRecord> =>
  s3
    .headObject({
      Bucket: bucket,
      Key: key,
      VersionId: version,
    })
    .promise()
    // @ts-expect-error
    .then(R.pipe(R.path(['Metadata', 'helium']), R.when(Boolean, JSON.parse)))

export interface ObjectMetaAndTags {
  meta?: JsonRecord | Error
  tags?: ObjectTags | Error
}

export function useObjectMetaAndTags(
  handle: Model.S3.S3ObjectLocation,
): ObjectMetaAndTags {
  const s3 = AWS.S3.use()
  const metaData = useData(objectMeta, { s3, handle })
  const tagsData = useData(objectTags, { s3, handle })
  const tagsCases = React.useCallback(
    (meta?: JsonRecord | Error) =>
      tagsData.case({
        Ok: (tags?: ObjectTags) => ({
          meta,
          tags,
        }),
        Err: (err: Error) => ({
          meta,
          tags: err,
        }),
        _: () => ({
          meta,
        }),
      }),
    [tagsData],
  )
  return metaData.case({
    Ok: (metadata: JsonRecord) => tagsCases(R.isEmpty(metadata) ? undefined : metadata),
    Err: (err: Error) => tagsCases(err),
    _: () => tagsCases(),
  })
}
