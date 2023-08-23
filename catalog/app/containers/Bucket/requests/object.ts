import type { S3 } from 'aws-sdk'
import * as R from 'ramda'

import type * as Model from 'model'
import type { JsonRecord } from 'utils/types'

interface ObjectTagsArgs {
  s3: S3
  location: Model.S3.S3ObjectLocation
}

export const objectTags = ({
  s3,
  location: { bucket, key, version },
}: ObjectTagsArgs): Promise<Record<string, string>> =>
  s3
    .getObjectTagging({
      Bucket: bucket,
      Key: key,
      VersionId: version,
    })
    .promise()
    .then(({ TagSet }) =>
      TagSet.reduce((memo, { Key, Value }) => ({ ...memo, [Key]: Value }), {}),
    )

interface ObjectMetaArgs {
  s3: S3
  location: Model.S3.S3ObjectLocation
}

export const objectMeta = ({
  s3,
  location: { bucket, key, version },
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
