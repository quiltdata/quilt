import { JsonValue } from './constants'

export const stringifyJSON = (obj: JsonValue) => JSON.stringify(obj, null, 2)

export function parseJSON(str: string) {
  try {
    return JSON.parse(str)
  } catch (e) {
    return str
  }
}
