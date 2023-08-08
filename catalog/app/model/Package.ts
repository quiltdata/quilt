export interface Hash {
  value: string // hash
  alias?: string // tag, ex. "latest"
}

export interface HashAlias {
  value?: string // hash
  alias: string // tag, ex. "latest"
}

export type Revision = Required<Hash> | Hash | HashAlias

export interface Handle {
  bucket: string
  name: string
}

export function isPackageHash(rev: Revision): rev is Hash {
  return !!rev.value
}

export function isPackageHashAlias(rev: Revision): rev is HashAlias {
  return !!rev.alias
}

export function hashOrTag(rev: Revision): string {
  // TODO
  // return rev.value || rev.alias
  if (isPackageHash(rev)) return rev.value
  return rev.alias
}
