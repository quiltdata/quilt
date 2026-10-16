import type { JsonSchema } from 'utils/JSONSchema'
import { hasLossyToken, isExactNumber } from 'utils/jsonNumbers'
import type * as Types from 'utils/types'

export interface PasteResult {
  fields: Types.JsonRecord
  /** Lines that were not "name<TAB>value", or held a value that cannot be stored as typed. */
  skipped: string[]
}

const NUMBER = /^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i

/** A pasted cell as the field's type wants it; text everywhere else, as typed. */
function coerce(text: string, prop?: JsonSchema): Types.Json | undefined {
  const types: unknown[] = Array.isArray(prop?.type) ? prop.type : [prop?.type]
  if ((types.includes('integer') || types.includes('number')) && NUMBER.test(text)) {
    // a number JSON.parse would round is not taken: the caller reports it
    const n = Number(text)
    if (hasLossyToken(text) || !isExactNumber(n)) return undefined
    if (types.includes('integer') && !Number.isInteger(n)) return text
    return n
  }
  if (types.includes('boolean') && /^(true|false)$/i.test(text)) {
    return text.toLowerCase() === 'true'
  }
  return text
}

/**
 * Two columns copied from a spreadsheet ("name<TAB>value" per line) as metadata fields.
 * A header row whose first cell is "field", "key" or "name" is dropped.
 */
export function parsePastedFields(text: string, schema?: JsonSchema): PasteResult {
  const fields: Types.JsonRecord = {}
  const skipped: string[] = []
  const lines = text.replace(/\r\n?/g, '\n').split('\n')
  lines.forEach((line, i) => {
    if (!line.trim()) return
    const [rawKey, ...rest] = line.split('\t')
    const key = rawKey.trim()
    if (i === 0 && /^(field|key|name)$/i.test(key)) return
    if (!key || !rest.length || key === '__proto__') {
      skipped.push(line)
      return
    }
    const value = coerce(rest.join('\t').trim(), schema?.properties?.[key])
    if (value === undefined) {
      skipped.push(line)
      return
    }
    // entries, not assignment: keeps "constructor" and similar names as own keys
    Object.defineProperty(fields, key, {
      configurable: true,
      enumerable: true,
      value,
      writable: true,
    })
  })
  return { fields, skipped }
}
