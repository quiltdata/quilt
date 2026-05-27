import type { S3 } from 'aws-sdk'

import type * as Model from 'model'

import type { RestoreStatus } from 'containers/Bucket/requests/restore'

import { PreviewError } from './types'

interface ArchivedSource {
  restore?: RestoreStatus
  storageClass?: S3.StorageClass
}

// Centralizes the Archived payload so every HEAD-derived call site carries the
// same restore + storage-class fields.
export function archivedError(handle: Model.S3.S3ObjectLocation, src: ArchivedSource) {
  return PreviewError.Archived({
    handle,
    restore: src.restore,
    storageClass: src.storageClass,
  })
}
