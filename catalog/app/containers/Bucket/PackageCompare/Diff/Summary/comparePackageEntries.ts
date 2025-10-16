import * as Model from 'model'

import * as s3paths from 'utils/s3paths'

import { compareJsons, type Change } from '../compareJsons'

type ChangeHash = { type: [string, string] } | { value: [string, string] } | null

function compareHash(base: Model.Checksum, other: Model.Checksum): ChangeHash {
  if (base.type !== other.type) return { type: [base.type, other.type] }
  if (base.value !== other.value) return { value: [base.value, other.value] }
  return null
}

export type ChangePhysicalKey =
  | { _tag: 'moved'; changed: [Model.S3.S3ObjectLocation, Model.S3.S3ObjectLocation] }
  | { _tag: 'version' }
  | { _tag: 'unmodified' }

function comparePhysicalKey(base: string, other: string): ChangePhysicalKey {
  const baseUrl = s3paths.parseS3Url(base)
  const otherUrl = s3paths.parseS3Url(other)

  const bucketModified = baseUrl.bucket !== otherUrl.bucket
  const keyModified = baseUrl.key !== otherUrl.key
  const versionModified = baseUrl.version !== otherUrl.version
  if (!bucketModified && !keyModified && !versionModified) return { _tag: 'unmodified' }
  if (!bucketModified && !keyModified) return { _tag: 'version' }
  return { _tag: 'moved', changed: [baseUrl, otherUrl] }
}

type ChangeSize = [number, number] | null

function compareSize(base: number, other: number): ChangeSize {
  if (base !== other) return [base, other]
  return null
}

export interface WhatsChangedInEntry {
  hash: ChangeHash
  meta: Change[]
  physicalKey: ChangePhysicalKey
  size: ChangeSize
}

export type EntryChange =
  | { _tag: 'modified'; logicalKey: string; changed: WhatsChangedInEntry }
  | { _tag: 'added'; logicalKey: string }
  | { _tag: 'removed'; logicalKey: string }

function compareEntries(
  base: Model.PackageEntry,
  other: Model.PackageEntry,
): WhatsChangedInEntry | null {
  const hash = compareHash(base.hash, other.hash)
  const meta = compareJsons(base.meta?.user_meta, other.meta?.user_meta)
  const physicalKey = comparePhysicalKey(base.physicalKey, other.physicalKey)
  const size = compareSize(base.size, other.size)

  if (!hash && !meta.length && !physicalKey && !size) return null

  return { hash, physicalKey, size, meta }
}

export default function getEntryChanges(
  base: Model.PackageContentsFlatMap,
  other: Model.PackageContentsFlatMap,
): EntryChange[] {
  const logicalKeys = Object.keys({ ...base, ...other }).sort()
  const entryChanges: EntryChange[] = []

  for (const logicalKey of logicalKeys) {
    const baseEntry = base[logicalKey]
    const otherEntry = other[logicalKey]

    if (!baseEntry) {
      entryChanges.push({ _tag: 'added', logicalKey })
    } else if (!otherEntry) {
      entryChanges.push({ _tag: 'removed', logicalKey })
    } else {
      const changed = compareEntries(baseEntry, otherEntry)
      if (changed) {
        entryChanges.push({ _tag: 'modified', logicalKey, changed })
      }
    }
  }

  return entryChanges
}
