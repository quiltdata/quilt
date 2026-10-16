import { allExact, hasLossyToken } from 'utils/jsonNumbers'

import { JsonValue } from './constants'

export const stringifyJSON = (obj: JsonValue) => JSON.stringify(obj, null, 2)

export function parseJSON(str: string) {
  // a number JSON.parse would round (1e-400, 9007199254740993) stays the text that was
  // typed, so the schema error shows instead of a silently changed value
  if (hasLossyToken(str)) return str
  try {
    const value = JSON.parse(str)
    return allExact(value) ? value : str
  } catch (e) {
    return str
  }
}
