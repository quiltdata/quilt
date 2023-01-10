import log from 'utils/Logging'
import { Json, JsonArray, JsonRecord } from 'utils/types'

export const enum Types {
  Brace = 'brace',
  Equal = 'equal',
  Key = 'key',
  Object = 'object',
  Primitive = 'primitive',
  Separator = 'separator',
  String = 'string',
  More = 'more',
}

interface SyntaxItem {
  childrenCount?: number
  original?: Json
  size: number
  type: Types
  value: string
}

interface SyntaxItemObject extends SyntaxItem {
  childrenCount: number
  original: JsonArray | JsonRecord
  type: Types.Object
  value: string
}

interface SyntaxGroup {
  elements: SyntaxItem[]
  size: number
}

type SyntaxPart = SyntaxItem | SyntaxGroup

const EQUAL: SyntaxItem = {
  type: Types.Equal,
  size: 2,
  value: ': ',
}

const SEPARATOR: SyntaxItem = {
  type: Types.Separator,
  size: 2,
  value: ', ',
}

const BRACE_LEFT: SyntaxItem = {
  type: Types.Brace,
  size: 2,
  value: '{ ',
}

const BRACE_RIGHT: SyntaxItem = {
  type: Types.Brace,
  size: 2,
  value: ' }',
}

const SQUARE_LEFT: SyntaxItem = {
  type: Types.Brace,
  size: 2,
  value: '[ ',
}

const SQUARE_RIGHT: SyntaxItem = {
  type: Types.Brace,
  size: 2,
  value: ' ]',
}

const Empty: SyntaxItem = {
  type: Types.Separator,
  size: 0,
  value: '',
}

function calcKey(key: string): SyntaxItem {
  return {
    value: key,
    type: Types.Key,
    size: key.length,
  }
}

function calcValue(value: Json): SyntaxItem {
  if (typeof value === 'string') {
    return {
      value: JSON.stringify(value),
      type: Types.String,
      size: value.length + 2, // + quotes
      original: value,
    }
  }
  if (typeof value === 'number' && !Number.isNaN(value)) {
    const v = JSON.stringify(value)
    return {
      value: v,
      type: Types.Primitive,
      size: v.length,
      original: value,
    }
  }
  if (typeof value === 'boolean') {
    return {
      value: JSON.stringify(value),
      type: Types.Primitive,
      size: value ? 4 : 5,
      original: value,
    }
  }
  if (value === null || Number.isNaN(value)) {
    return {
      value: JSON.stringify(value),
      type: Types.Primitive,
      size: 4,
      original: value,
    }
  }
  if (typeof value === 'object' && Array.isArray(value)) {
    const childrenCount = value.length
    const v = `[ …${childrenCount} ]`
    return {
      value: v,
      type: Types.Object,
      size: v.length,
      original: value,
      childrenCount,
    }
  }
  if (typeof value === 'object') {
    const childrenCount = Object.keys(value).length
    const v = `{ …${childrenCount} }`
    return {
      value: v,
      type: Types.Object,
      size: v.length,
      original: value,
      childrenCount,
    }
  }
  log.warn('Unexpected JSON type')
  return Empty
}

function calcObject(obj: JsonArray | JsonRecord, showValues: boolean): SyntaxPart[] {
  if (Array.isArray(obj)) {
    const items = obj.map((v) => {
      if (!showValues) {
        return Empty
      }

      const value = calcValue(v)
      return {
        elements: [value],
        size: value.size,
      }
    })
    const itemsWithSeparators = items.reduce(
      (memo, item, index) => (index > 0 ? [...memo, SEPARATOR, item] : [...memo, item]),
      [] as SyntaxPart[],
    )
    return [SQUARE_LEFT, ...itemsWithSeparators, SQUARE_RIGHT]
  }

  const items = Object.entries(obj).map(([k, v]) => {
    const key = calcKey(k)
    if (!showValues) {
      return {
        elements: [key],
        size: key.size,
      }
    }

    const value = calcValue(v)
    return {
      elements: [key, EQUAL, value],
      size: key.size + EQUAL.size + value.size,
    }
  })
  const itemsWithSeparators = items.reduce(
    (memo, item, index) => (index > 0 ? [...memo, SEPARATOR, item] : [...memo, item]),
    [] as SyntaxPart[],
  )
  return [BRACE_LEFT, ...itemsWithSeparators, BRACE_RIGHT]
}

export interface SyntaxData {
  parts: SyntaxItem[]
  availableSpace: number
  done?: boolean
}

function reduceElement(memo: SyntaxData, element: SyntaxItem): SyntaxData {
  return {
    parts: [...memo.parts, element],
    availableSpace: memo.availableSpace - element.size,
  }
}

function isSyntaxItem(item: SyntaxPart): item is SyntaxItem {
  return !!(item as SyntaxItem).type
}

function isSyntaxGroup(item: SyntaxPart): item is SyntaxGroup {
  return !!(item as SyntaxGroup).elements
}

function isNestedStructure(item: SyntaxPart): item is SyntaxItemObject {
  return (item as SyntaxItem).type === Types.Object
}

function spaceForRestKeys(items: SyntaxPart[], index: number): number {
  return items.slice(index).reduce((memo, item) => {
    if (isSyntaxItem(item)) return memo + item.size
    if (isSyntaxGroup(item)) return memo + item.elements[0]?.size || 0
    return 0
  }, 0)
}

function isEnoughForRestKeys(items: SyntaxPart[], index: number, availableSpace: number) {
  return availableSpace - (items[index].size - spaceForRestKeys(items, index)) > 0
}

function getFirstLevelMoreItems(items: SyntaxPart[], index: number): SyntaxItem {
  const moreItems = items.slice(index).filter((x) => !isSyntaxItem(x))
  const value = index > 0 ? `, <…${moreItems.length}>` : `<…${moreItems.length}>`
  return moreItems.length
    ? {
        size: value.length,
        type: Types.More,
        value,
      }
    : Empty
}

function getSecondLevelMoreItems(item: SyntaxItemObject): SyntaxItem {
  const value = `<…${item.childrenCount}>`
  return {
    size: value.length,
    type: Types.More,
    value,
  }
}

function isEnoughForBraces(
  items: SyntaxPart[],
  more: SyntaxItem,
  availableSpace: number,
) {
  return availableSpace - (items[0].size + items[items.length - 1].size + more.size) > 0
}

function wrapBracesOnFirstLevel(
  memo: SyntaxData,
  items: SyntaxPart[],
  item: SyntaxItem,
): SyntaxData {
  const braceLeft = items[0] as SyntaxItem
  const braceRight = items[items.length - 1] as SyntaxItem

  const left = memo.parts.length > 0 ? memo : reduceElement(memo, braceLeft)
  const center = reduceElement(left, item)
  const right = reduceElement(center, braceRight)
  return right
}

function wrapBracesOnSecondLevel(memo: SyntaxData, item: SyntaxItemObject): SyntaxData {
  const more = getSecondLevelMoreItems(item)
  const leftBrace = Array.isArray(item.original) ? SQUARE_LEFT : BRACE_LEFT
  const rightBrace = Array.isArray(item.original) ? SQUARE_RIGHT : BRACE_RIGHT
  return {
    parts: [...memo.parts, leftBrace, more, rightBrace],
    availableSpace:
      memo.availableSpace + item.size - leftBrace.size - more.size - rightBrace.size,
  }
}

export function print(
  obj: JsonRecord | JsonArray,
  availableSpace: number,
  showValues: boolean,
): SyntaxData {
  const items = calcObject(obj, showValues)
  const firstLevel = items.reduce(
    (memo, item, index) => {
      if (memo.done) return memo

      if (isSyntaxItem(item)) {
        const output = reduceElement(memo, item)
        const more = getFirstLevelMoreItems(items, index)
        if (isEnoughForBraces(items, more, output.availableSpace)) {
          return output
        }
        return {
          ...wrapBracesOnFirstLevel(memo, items, more),
          done: true,
        }
      }

      if (isSyntaxGroup(item)) {
        if (!isEnoughForRestKeys(items, index, memo.availableSpace)) {
          return reduceElement(memo, item.elements[0])
        }
        return item.elements.reduce((acc, element) => reduceElement(acc, element), memo)
      }

      return memo
    },
    {
      parts: [],
      availableSpace,
    } as SyntaxData,
  )
  return firstLevel.parts.reduce(
    (memo, item) => {
      if (!isNestedStructure(item)) {
        return {
          ...memo,
          parts: [...memo.parts, item],
        }
      }
      if (memo.availableSpace <= 0) {
        return wrapBracesOnSecondLevel(memo, item)
      }
      const secondLevel = print(
        item.original,
        memo.availableSpace + item.size,
        showValues,
      )
      return {
        availableSpace: secondLevel.availableSpace,
        parts: [...memo.parts, ...secondLevel.parts],
      }
    },
    {
      parts: [],
      availableSpace: firstLevel.availableSpace,
    } as SyntaxData,
  )
}
