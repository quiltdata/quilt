import * as R from 'ramda'

export interface PackageHandle {
  bucket: string
  name: string
  hash: string
}

export function shortenRevision(fullRevision: string): string {
  return R.take(10, fullRevision)
}
