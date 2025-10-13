import { diffLines } from 'diff'

import type { JsonRecord } from 'utils/types'
import * as yaml from 'utils/yaml'

type Change =
  | { _tag: 'added'; value: string }
  | { _tag: 'removed'; value: string }
  | { _tag: 'unmodified'; value: string }

export default function diffJsons(
  base: JsonRecord | null,
  other: JsonRecord | null,
  changesOnly: boolean = false,
): Change[] {
  return (
    // We believe showing braces frighten wet scientists
    diffLines(yaml.stringify(base || {}), yaml.stringify(other || {}))
      .filter((c) => c.value.trim())
      .filter((c) => !changesOnly || c.added || c.removed)
      .map((c) => {
        if (c.added) return { _tag: 'added', value: c.value }
        if (c.removed) return { _tag: 'removed', value: c.value }
        return { _tag: 'unmodified', value: c.value }
      })
  )
}
