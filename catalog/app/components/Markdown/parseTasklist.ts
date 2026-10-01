import type { StateInline } from './markdownItTypes'

export const CHECKED = 'tasklist_checked'
export const UNCHECKED = 'tasklist_unchecked'

// Only match `[` at the start of inline content or after whitespace, so
// mid-word occurrences like `a[x]b` are left as plain text.
const isAtBoundary = (state: StateInline) =>
  state.pos === 0 || /\s/.test(state.src.charAt(state.pos - 1))

export function parse(state: StateInline, silent = false) {
  if (!isAtBoundary(state)) return false

  const { src, pos } = state

  if (src.startsWith('[ ]', pos) || src.startsWith('[]', pos)) {
    if (!silent) state.push(UNCHECKED, '', 0)
    state.pos = pos + (src.charAt(pos + 1) === ']' ? 2 : 3)
    return true
  }

  if (src.startsWith('[x]', pos) || src.startsWith('[X]', pos)) {
    if (!silent) state.push(CHECKED, '', 0)
    state.pos = pos + 3
    return true
  }

  return false
}
