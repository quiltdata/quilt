import type { S3, AWSError } from 'aws-sdk'

import type * as Model from 'model'
import * as AWS from 'utils/AWS'
import * as Data from 'utils/Data'

import { PreviewError } from '../types'

interface SizeThresholds {
  autoFetch: number
  neverFetch: number
}

const SIZE_THRESHOLDS: SizeThresholds = {
  autoFetch: 128 * 1024, // automatically load if <= 128kB
  neverFetch: 1024 * 1024, // never load if > 1MB
}

function isAWSError(error: unknown): error is AWSError {
  return error instanceof Error && !!(error as AWSError).code
}

interface GateArgs {
  s3: S3
  handle: Model.S3.S3ObjectLocation
  thresholds?: Partial<SizeThresholds>
}

// TODO: make it more general-purpose "head"?
async function gate({ s3, handle, thresholds = {} }: GateArgs) {
  let length: number | undefined
  const req = s3.headObject({
    Bucket: handle.bucket,
    Key: handle.key,
    VersionId: handle.version,
  })
  try {
    const head = await req.promise()
    length = head.ContentLength
    if (head.DeleteMarker) throw PreviewError.Deleted({ handle })
    if (head.StorageClass === 'GLACIER' || head.StorageClass === 'DEEP_ARCHIVE') {
      throw PreviewError.Archived({ handle })
    }
  } catch (e) {
    if (PreviewError.is(e)) throw e
    if (!isAWSError(e)) throw e
    // NOTE: it is actually not an AWSError strictly
    //       e.code can be a number
    // TODO: use `e.statusCode`?
    if ((e as $TSFixMe).code === 405 && handle.version != null) {
      // assume delete marker when 405 and version is defined,
      // since GET and HEAD methods are not allowed on delete markers
      // (https://github.com/boto/botocore/issues/674)
      throw PreviewError.Deleted({ handle })
    }
    if (e.code === 'BadRequest' && handle.version != null) {
      // assume invalid version when 400 and version is defined
      throw PreviewError.InvalidVersion({ handle })
    }
    if (
      e.code === 'NotFound' &&
      (req as $TSFixMe).response.httpResponse.headers['x-amz-delete-marker'] === 'true'
    ) {
      throw PreviewError.Deleted({ handle })
    }
    if (['NoSuchKey', 'NotFound'].includes(e.name)) {
      throw PreviewError.DoesNotExist({ handle })
    }
    // eslint-disable-next-line no-console
    console.error('Error loading preview')
    // eslint-disable-next-line no-console
    console.error(e)
    throw e
  }
  if (length && length > (thresholds.autoFetch || SIZE_THRESHOLDS.autoFetch)) {
    throw PreviewError.TooLarge({ handle })
  }
  return length && length > (thresholds.neverFetch || SIZE_THRESHOLDS.neverFetch)
}

export default function useGate(
  handle: Model.S3.S3ObjectLocation,
  thresholds?: Partial<SizeThresholds>,
) {
  const s3 = AWS.S3.use()
  return Data.use(gate, { s3, handle, thresholds })
}
