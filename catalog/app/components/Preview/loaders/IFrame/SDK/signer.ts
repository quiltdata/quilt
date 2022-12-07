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

const traverseEchartsUrls = (fn: (v: any) => any, json: JsonRecord) =>
  R.evolve(
    {
      source: fn,
    },
    json,
  )

function createObjectUrlsSigner(
  traverseUrls: (fn: (v: any) => any, json: JsonRecord) => JsonRecord,
  processUrl: (path: string) => Promise<JsonRecord | string>,
) {
  return async (json: JsonRecord) => {
    const promises: Promise<JsonRecord | string>[] = []
    const jsonWithPlaceholders = traverseUrls((url: string): number => {
      const len = promises.push(processUrl(url))
      return len - 1
    }, json)
    const results = await Promise.all(promises)
    return traverseUrls(
      (idx: number): JsonRecord | string => results[idx],
      jsonWithPlaceholders,
    )
  }
}

export function igv(processUrl: (path: string) => Promise<string>, json: JsonRecord) {
  return createObjectUrlsSigner(traverseIgvUrls, processUrl)(json)
}

export function echarts(
  processUrl: (path: string) => Promise<JsonRecord>,
  json: JsonRecord,
) {
  return createObjectUrlsSigner(traverseEchartsUrls, processUrl)(json)
}
