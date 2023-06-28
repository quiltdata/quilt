import type { S3 } from 'aws-sdk'
import * as R from 'ramda'

import type * as Model from 'model'
import type { JsonRecord } from 'utils/types'

interface ObjectTagsArgs {
  s3: S3
  handle: Model.S3.S3ObjectLocation
}

export type Tags = Record<string, string>[] | null

export const objectTags = ({
  s3,
  handle: { bucket, key, version },
}: ObjectTagsArgs): Promise<Tags> =>
  s3
    .getObjectTagging({
      Bucket: bucket,
      Key: key,
      VersionId: version,
    })
    .promise()
    .then(({ TagSet }) => TagSet.map(({ Key, Value }) => ({ [Key]: Value })))
    .then((tags) => (tags.length ? tags : null))

interface ObjectMetaArgs {
  s3: S3
  handle: Model.S3.S3ObjectLocation
}

// TODO: handle archive, delete markers
//       make re-useable head request with such handlers
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
