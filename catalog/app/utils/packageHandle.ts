import * as R from 'ramda'

export function shortenRevision(fullRevision: string): string {
  return R.take(10, fullRevision)
}
