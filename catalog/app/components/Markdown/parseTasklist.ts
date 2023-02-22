import type { Remarkable } from 'remarkable'

export interface CheckboxContentToken extends Remarkable.ContentToken {
  checked: boolean
}

const isChar = (charIndex: number, str: string, charPosition: number) =>
  str.charCodeAt(charPosition) === charIndex
const isOpenBracket = isChar.bind(null, 91)
const isCloseBracket = isChar.bind(null, 93)
const isCross = (str: string, charPosition: number) =>
  isChar(120, str, charPosition) || isChar(88, str, charPosition)
const isSpace = isChar.bind(null, 32)

// TODO: Wait for https://github.com/jonschlinkert/remarkable/pull/401 and then remove
export default function parseTasklist(state: Remarkable.StateInline) {
  const charPosition = state.pos

  if (charPosition === state.posMax) return false
  if (!isOpenBracket(state.src, charPosition)) return false

  const nextCharPosition = charPosition + 1
  if (isCloseBracket(state.src, nextCharPosition)) {
    state.push({
      type: 'tasklist',
      checked: false,
      level: state.level,
    } as CheckboxContentToken)
    state.pos = nextCharPosition + 1
    return true
  }

  if (isCross(state.src, nextCharPosition) || isSpace(state.src, nextCharPosition)) {
    const lastCharPosition = nextCharPosition + 1
    if (!isCloseBracket(state.src, lastCharPosition)) return false

    state.push({
      type: 'tasklist',
      checked: isCross(state.src, nextCharPosition),
      level: state.level,
    } as CheckboxContentToken)
    state.pos = lastCharPosition + 1
    return true
  }

  return false
}
