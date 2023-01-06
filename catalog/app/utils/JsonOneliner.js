export const Types = {
  Brace: 'brace',
  Equal: 'equal',
  Key: 'key',
  Object: 'object',
  Primitive: 'primitive',
  Separator: 'separator',
  String: 'string',
  More: 'more',
}

const EQUAL = {
  type: Types.Equal,
  size: 2,
  value: ': ',
}

const SEPARATOR = {
  type: Types.Separator,
  size: 2,
  value: ', ',
}

const BRACE_LEFT = {
  type: Types.Brace,
  size: 2,
  value: '{ ',
}

const BRACE_RIGHT = {
  type: Types.Brace,
  size: 2,
  value: ' }',
}

const SQUARE_LEFT = {
  type: Types.Brace,
  size: 2,
  value: '[ ',
}

const SQUARE_RIGHT = {
  type: Types.Brace,
  size: 2,
  value: ' ]',
}

function calcKey(key) {
  return {
    value: key,
    type: Types.Key,
    size: key.length,
  }
}

function calcValue(value) {
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
}

function calcObject(obj, showValues) {
  if (Array.isArray(obj)) {
    const items = obj.map((v) => {
      if (!showValues) {
        return {
          elements: [],
          size: 0,
        }
      }

      const value = calcValue(v)
      return {
        elements: [value],
        size: value.size,
      }
    })
    const itemsWithSeparators = items.reduce((memo, item, index) => {
      return index > 0 ? [...memo, SEPARATOR, item] : [...memo, item]
    }, [])
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
  const itemsWithSeparators = items.reduce((memo, item, index) => {
    return index > 0 ? [...memo, SEPARATOR, item] : [...memo, item]
  }, [])
  return [BRACE_LEFT, ...itemsWithSeparators, BRACE_RIGHT]
}

function reduceElement(memo, element) {
  return {
    parts: [...memo.parts, element],
    availableSpace: memo.availableSpace - element.size,
  }
}

function spaceForRestKeys(items, index) {
  return items.slice(index).reduce((memo, item) => {
    if (item.type) return memo + item.size
    if (item.elements) return memo + item.elements[0]?.size || 0
    return 0
  }, 0)
}

function isEnoughForRestKeys(items, index, availableSpace) {
  return availableSpace - (items[index].size - spaceForRestKeys(items, index)) > 0
}

function getMoreItems(items, index) {
  const moreItems = items.slice(index).filter((x) => !x.type)
  const value = index > 0 ? `, <…${moreItems.length}>` : `<…${moreItems.length}>`
  return moreItems.length
    ? {
        value,
        size: value.length,
      }
    : {
        value: '',
        size: 0,
      }
}

function isEnoughForBraces(items, more, availableSpace) {
  return availableSpace - (items[0].size + items[items.length - 1].size + more.size) > 0
}

export function print(obj, availableSpace, showValues) {
  const items = calcObject(obj, showValues)
  const firstLevel = items.reduce(
    (memo, item, index) => {
      if (memo.done) return memo

      if (item.type) {
        const output = reduceElement(memo, item)
        const more = getMoreItems(items, index)
        if (isEnoughForBraces(items, more, output.availableSpace)) {
          return output
        }
        // const braceRight = Array.isArray(obj) ? SQUARE_RIGHT : BRACE_RIGHT;
        // const braceLeft = Array.isArray(obj) ? SQUARE_LEFT : BRACE_LEFT;
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

      if (item.elements) {
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
    },
  )
  if (firstLevel.availableSpace < 0) {
    return firstLevel
  }
  return firstLevel.parts.reduce(
    (memo, item) => {
      if (item.type !== 'object') {
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
    },
  )
}
