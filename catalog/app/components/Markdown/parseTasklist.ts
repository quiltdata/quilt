import type { StateInline, Token } from 'markdown-it'

export interface CheckboxContentToken extends Token {
  checked: boolean
}

const isChar = (charIndex: number, str: string, charPosition: number) =>
  str.charCodeAt(charPosition) === charIndex
const isOpenBracket = isChar.bind(null, 91)
const isCloseBracket = isChar.bind(null, 93)
const isCross = (str: string, charPosition: number) =>
  isChar(120, str, charPosition) || isChar(88, str, charPosition)
const isSpace = isChar.bind(null, 32)

export default function parseTasklist(state: StateInline) {
  const charPosition = state.pos

  if (charPosition === state.posMax) return false
  if (!isOpenBracket(state.src, charPosition)) return false

  const nextCharPosition = charPosition + 1
  if (isCloseBracket(state.src, nextCharPosition)) {
    const token = state.push('tasklist', '', 0)
    ;(token as CheckboxContentToken).checked = false
    state.pos = nextCharPosition + 1
    return true
  }

  if (isCross(state.src, nextCharPosition) || isSpace(state.src, nextCharPosition)) {
    const lastCharPosition = nextCharPosition + 1
    if (!isCloseBracket(state.src, lastCharPosition)) return false

    const token = state.push('tasklist', '', 0)
    ;(token as CheckboxContentToken).checked = isCross(state.src, nextCharPosition)
    state.pos = lastCharPosition + 1
    return true
  }

  return false
}
