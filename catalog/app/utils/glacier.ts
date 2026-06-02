// Helpers for S3 Glacier / Deep Archive restore state: reading restore status
// from a HEAD header or a LIST response, deriving whether an object is
// effectively archived, and the retrieval-tier type the restore API accepts.

import type { S3 } from 'aws-sdk'

export interface RestoreStatus {
  ongoing: boolean
  expiresAt?: Date
}

// Parse S3's `x-amz-restore` HEAD header (Glacier / Deep Archive):
//   ongoing-request="true"                          -> { ongoing: true }
//   ongoing-request="false", expiry-date="<http>"   -> { ongoing: false, expiresAt }
// Missing / malformed -> undefined.
function parseRestoreHeader(value: S3.Restore | undefined): RestoreStatus | undefined {
  if (!value) return undefined

  const ongoingMatch = value.match(/ongoing-request="(true|false)"/)
  if (!ongoingMatch) return undefined
  const ongoing = ongoingMatch[1] === 'true'

  if (ongoing) return { ongoing: true }

  const expiryMatch = value.match(/expiry-date="([^"]+)"/)
  if (!expiryMatch) return { ongoing: false }
  const parsed = new Date(expiryMatch[1])
  if (Number.isNaN(parsed.getTime())) return { ongoing: false }
  return { ongoing: false, expiresAt: parsed }
}

// Read the per-object `RestoreStatus` element S3 returns in a LIST response when
// the request opts in via OptionalObjectAttributes=RestoreStatus:
//   IsRestoreInProgress=true                      -> { ongoing: true }
//   IsRestoreInProgress=false, RestoreExpiryDate  -> { ongoing: false, expiresAt }
// Absent / unrestored -> undefined.
function parseRestoreStatus(
  value: S3.RestoreStatus | undefined,
): RestoreStatus | undefined {
  if (value?.IsRestoreInProgress == null) return undefined
  return value.IsRestoreInProgress
    ? { ongoing: true }
    : { ongoing: false, expiresAt: value.RestoreExpiryDate }
}

const isArchiveStorageClass = (storageClass: S3.StorageClass | undefined): boolean =>
  storageClass === 'GLACIER' || storageClass === 'DEEP_ARCHIVE'

const hasLiveRestoredCopy = (restore: RestoreStatus | undefined): boolean =>
  !!restore && !restore.ongoing && !!restore.expiresAt && restore.expiresAt > new Date()

const isEffectivelyArchived = (
  storageClass: S3.StorageClass | undefined,
  restore: RestoreStatus | undefined,
): boolean => isArchiveStorageClass(storageClass) && !hasLiveRestoredCopy(restore)

// An object's restore state: the parsed restore status plus whether it's still
// effectively archived (archive storage class with no live restored copy). Two
// entry points for S3's two sources — the HEAD `x-amz-restore` header and the
// LIST `RestoreStatus` element — each parses once and classifies.
export function restoreStateFromHeader(
  storageClass: S3.StorageClass | undefined,
  value: S3.Restore | undefined,
): { restore?: RestoreStatus; archived: boolean } {
  const restore = parseRestoreHeader(value)
  return { restore, archived: isEffectivelyArchived(storageClass, restore) }
}

export function restoreStateFromList(
  storageClass: S3.StorageClass | undefined,
  value: S3.RestoreStatus | undefined,
): { restore?: RestoreStatus; archived: boolean } {
  const restore = parseRestoreStatus(value)
  return { restore, archived: isEffectivelyArchived(storageClass, restore) }
}

// Narrows the SDK's `S3.Tier`, whose `| string` member erases literal
// narrowing. Our own union keeps exhaustiveness and catches typos.
export type GlacierTier = 'Standard' | 'Bulk' | 'Expedited'
