import * as R from 'ramda'

import type { JsonRecord } from 'utils/types'

const traverseIgvUrls = (fn: (v: any) => any, json: JsonRecord) =>
  R.evolve(
    {
      reference: R.evolve({
        fastaURL: fn,
        indexURL: fn,
        cytobandURL: fn,
        aliasURL: fn,
      }),
      tracks: R.map(
        R.evolve({
          url: fn,
          indexURL: fn,
        }),
      ),
    },
    json,
  )

function createObjectUrlsSigner(
  traverseUrls: (fn: (v: any) => any, json: JsonRecord) => JsonRecord,
  processUrl: (path: string) => Promise<string>,
) {
  return async (json: JsonRecord) => {
    const promises: Promise<string>[] = []
    const jsonWithPlaceholders = traverseUrls((url: string): number => {
      const len = promises.push(processUrl(url))
      return len - 1
    }, json)
    const results = await Promise.all(promises)
    return traverseUrls((idx: number): string => results[idx], jsonWithPlaceholders)
  }
}

export function igv(processUrl: (path: string) => Promise<string>, json: JsonRecord) {
  return createObjectUrlsSigner(traverseIgvUrls, processUrl)(json)
}
