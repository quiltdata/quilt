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
  original?: Json
  size: number
  type: Types
  value: string
}

interface SyntaxItemObject extends SyntaxItem {
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
    const v = `[ …${value.length} ]`
    return {
      value: v,
      type: Types.Object,
      size: v.length,
      original: value,
    }
  }
  if (typeof value === 'object') {
    const v = `{ …${Object.keys(value).length} }`
    return {
      value: v,
      type: Types.Object,
      size: v.length,
      original: value,
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

interface SyntaxData {
  parts: SyntaxPart[]
  availableSpace: number
  done?: boolean
}

function reduceElement(memo: SyntaxData, element: SyntaxPart): SyntaxData {
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

function getMoreItems(items: SyntaxPart[], index: number): SyntaxItem {
  const moreItems = items.slice(index).filter((x) => !isSyntaxItem(x))
  const value = index > 0 ? `, <!${moreItems.length}>` : `<!${moreItems.length}>`
  return moreItems.length
    ? {
        size: value.length,
        type: Types.More,
        value,
      }
    : Empty
}

function isEnoughForBraces(
  items: SyntaxPart[],
  more: SyntaxItem,
  availableSpace: number,
) {
  return availableSpace - (items[0].size + items[items.length - 1].size + more.size) > 0
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
        const more = getMoreItems(items, index)
        if (isEnoughForBraces(items, more, output.availableSpace)) {
          return output
        }
        const braceRight = items[items.length - 1]
        const braceLeft = items[0]
        const moreEl = reduceElement(
          index > 0 ? memo : reduceElement(memo, braceLeft),
          more,
        )
        const closeBracket = reduceElement(moreEl, braceRight)
        return {
          ...closeBracket,
          done: true,
        }
      }

      if (isSyntaxGroup(item)) {
        if (!isEnoughForRestKeys(items, index, memo.availableSpace)) {
          return reduceElement(memo, item.elements[0])
        }
        return item.elements.reduce((acc, element) => {
          const output = reduceElement(acc, element)
          return output
        }, memo)
      }

      return memo
    },
    {
      parts: [],
      availableSpace,
    } as SyntaxData,
  )
  if (firstLevel.availableSpace < 0) {
    return firstLevel
  }
  return firstLevel.parts.reduce(
    (memo, item) => {
      if (!isNestedStructure(item)) {
        return {
          ...memo,
          parts: [...memo.parts, item],
        }
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
