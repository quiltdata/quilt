export interface RestoreStatus {
  ongoing: boolean
  expiresAt?: Date
}

// Parse S3's `x-amz-restore` HEAD header (Glacier / Deep Archive):
//   ongoing-request="true"                          -> { ongoing: true }
//   ongoing-request="false", expiry-date="<http>"   -> { ongoing: false, expiresAt }
// Missing / malformed -> undefined.
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

export const isArchiveStorageClass = (storageClass: string | undefined): boolean =>
  storageClass === 'GLACIER' || storageClass === 'DEEP_ARCHIVE'

const hasLiveRestoredCopy = (restore: RestoreStatus | undefined, now: Date): boolean =>
  !!restore && !restore.ongoing && !!restore.expiresAt && restore.expiresAt > now

export function isEffectivelyArchived(
  storageClass: string | undefined,
  restore: RestoreStatus | undefined,
  now: Date = new Date(),
): boolean {
  return isArchiveStorageClass(storageClass) && !hasLiveRestoredCopy(restore, now)
}
