import type { PackageHash, PackageHashAlias, PackageRevision } from './index'

export function isPackageHash(rev: PackageRevision): rev is PackageHash {
  return !!rev.value
}

export function isPackageHashAlias(rev: PackageRevision): rev is PackageHashAlias {
  return !!rev.alias
}

export function hashOrTag(rev: PackageRevision): string {
  // TODO
  // return rev.value || rev.alias
  if (isPackageHash(rev)) return rev.value
  return rev.alias
}
