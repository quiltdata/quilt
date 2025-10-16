import type * as JSONPointer from 'utils/JSONPointer'
import type { Json, JsonArray, JsonRecord } from 'utils/types'

export type Change =
  | { _tag: 'modified'; pointer: JSONPointer.Path; oldValue: Json; newValue: Json }
  | { _tag: 'added'; pointer: JSONPointer.Path; newValue: Json }
  | { _tag: 'removed'; pointer: JSONPointer.Path; oldValue: Json }

function isObject(value: any): value is JsonRecord {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

export function compareValues(
  pointer: JSONPointer.Path,
  baseValue: Json | undefined,
  otherValue: Json | undefined,
): Change[] {
  if (baseValue === otherValue) return []

  if (baseValue === undefined) {
    if (otherValue === undefined) return []
    return [{ _tag: 'added', pointer, newValue: otherValue }]
  }

  if (otherValue === undefined) {
    if (baseValue === undefined) return []
    return [{ _tag: 'removed', pointer, oldValue: baseValue }]
  }

  if (isObject(baseValue) && isObject(otherValue)) {
    return compareObjectsRecursive(baseValue, otherValue, pointer)
  } else if (Array.isArray(baseValue) && Array.isArray(otherValue)) {
    return compareArraysRecursive(baseValue, otherValue, pointer)
  } else {
    return [{ _tag: 'modified', pointer, oldValue: baseValue, newValue: otherValue }]
  }
}

export function compareObjectsRecursive(
  baseObj: JsonRecord,
  otherObj: JsonRecord,
  prefix: JSONPointer.Path = [],
): Change[] {
  const changedKeys: Change[] = []
  const combinedKeys = Object.keys({ ...baseObj, ...otherObj })

  for (const key of combinedKeys) {
    const pointer = prefix.length ? [...prefix, key] : [key]
    const baseValue = baseObj[key]
    const otherValue = otherObj[key]
    changedKeys.push(...compareValues(pointer, baseValue, otherValue))
  }

  return changedKeys
}

export function compareArraysRecursive(
  baseObj: JsonArray,
  otherObj: JsonArray,
  prefix: JSONPointer.Path = [],
): Change[] {
  const changedKeys: Change[] = []
  const length = Math.max(baseObj.length, otherObj.length)

  for (let i = 0; i < length; i++) {
    const pointer = prefix.length ? [...prefix, i] : [i]
    const baseValue = baseObj[i]
    const otherValue = otherObj[i]
    changedKeys.push(...compareValues(pointer, baseValue, otherValue))
  }

  return changedKeys
}

export function compareJsonRecords(baseObj: JsonRecord, otherObj: JsonRecord): Change[] {
  return compareObjectsRecursive(baseObj, otherObj)
}

export function compareJsons(baseObj?: Json, otherObj?: Json): Change[] {
  return compareValues([], baseObj, otherObj)
}
