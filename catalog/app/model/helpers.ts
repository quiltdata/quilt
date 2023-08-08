import type { PackageHash, PackageHashAlias, PackageRevision } from './index'

export function isPackageHash(h: PackageRevision): h is PackageHash {
  return !!h.value
}

export function isPackageHashAlias(h: PackageRevision): h is PackageHashAlias {
  return !!h.alias
}

export function hashOrTag(rev: PackageRevision): string {
  if (isPackageHash(rev)) return rev.value
  return rev.alias
}
