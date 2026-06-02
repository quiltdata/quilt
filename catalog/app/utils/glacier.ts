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

// The S3 archive storage classes. Narrower than the SDK's `S3.StorageClass`
// (whose `| string` member erases literal narrowing), so it stays exhaustive
// and catches typos.
export type StorageClass = 'GLACIER' | 'DEEP_ARCHIVE'

const isArchiveStorageClass = (
  storageClass: S3.StorageClass | undefined,
): storageClass is StorageClass =>
  storageClass === 'GLACIER' || storageClass === 'DEEP_ARCHIVE'

const hasLiveRestoredCopy = (restore: RestoreStatus | undefined): boolean =>
  !!restore && !restore.ongoing && !!restore.expiresAt && restore.expiresAt > new Date()

// The archive tier an object is *effectively* stored in: an archive storage
// class with no live restored copy. Returns `false` when the object is readable
// as-is — a non-archive class, or an archive class with a live restored copy.
const effectiveArchiveClass = (
  storageClass: S3.StorageClass | undefined,
  restore: RestoreStatus | undefined,
): StorageClass | false => {
  if (!isArchiveStorageClass(storageClass)) return false
  if (hasLiveRestoredCopy(restore)) return false
  return storageClass
}

// An object's archive state: the effective archive tier (`false` when the object
// is not effectively archived) plus the parsed restore status. `value` is S3's
// restore for the object from either source — the HEAD `x-amz-restore` header
// (a string) or the LIST `RestoreStatus` element.
export function getArchiveState(
  storageClass: S3.StorageClass | undefined,
  value: S3.Restore | S3.RestoreStatus | undefined,
): { restore?: RestoreStatus; archived: StorageClass | false } {
  const restore =
    typeof value === 'string' ? parseRestoreHeader(value) : parseRestoreStatus(value)
  return { restore, archived: effectiveArchiveClass(storageClass, restore) }
}

// Narrows the SDK's `S3.Tier`, whose `| string` member erases literal
// narrowing. Our own union keeps exhaustiveness and catches typos.
export type RetrievalTier = 'Standard' | 'Bulk' | 'Expedited'
