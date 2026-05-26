export interface RestoreStatus {
  ongoing: boolean
  expiresAt?: Date
}

// Parse the `x-amz-restore` HEAD response header emitted by S3 for Glacier /
// Deep Archive objects.
//
// Format examples:
//   ongoing-request="true"
//     -> { ongoing: true }
//   ongoing-request="false", expiry-date="Fri, 21 Dec 2012 00:00:00 GMT"
//     -> { ongoing: false, expiresAt: Date }
//
// Returns undefined for missing or malformed values.
export function parseRestoreHeader(value: string | undefined): RestoreStatus | undefined {
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

// Derived predicate: an object whose StorageClass is GLACIER or DEEP_ARCHIVE
// counts as "effectively archived" unless a live restored temp copy is
// available.
export function isEffectivelyArchived(
  storageClass: string | undefined,
  restore: RestoreStatus | undefined,
  now: Date = new Date(),
): boolean {
  if (storageClass !== 'GLACIER' && storageClass !== 'DEEP_ARCHIVE') return false
  if (!restore) return true
  if (restore.ongoing) return true
  if (!restore.expiresAt) return true
  return restore.expiresAt <= now
}
