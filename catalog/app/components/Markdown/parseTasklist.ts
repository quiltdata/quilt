import type { Remarkable } from 'remarkable'

export interface CheckboxContentToken extends Remarkable.ContentToken {
  checked: boolean
}

// Wait for https://github.com/jonschlinkert/remarkable/pull/401 and then remove
export default function parseTasklist(state: Remarkable.StateInline) {
  var pos = state.pos
  var maxpos = state.posMax
  if (pos === maxpos) {
    return false
  }
  if (state.src.charCodeAt(pos) !== 91) {
    return false
  }
  ++pos
  if (state.src.charCodeAt(pos) === 93) {
    state.push({
      type: 'tasklist',
      checked: false,
      level: state.level,
    } as CheckboxContentToken)
    state.pos = pos + 1
    return true
  }
  if (
    state.src.charCodeAt(pos) === 120 ||
    state.src.charCodeAt(pos) === 88 ||
    state.src.charCodeAt(pos) === 32
  ) {
    var checked = state.src.charCodeAt(pos) !== 32
    ++pos
    if (state.src.charCodeAt(pos) !== 93) {
      return false
    }
    state.push({
      type: 'tasklist',
      checked: checked,
      level: state.level,
    } as CheckboxContentToken)
    state.pos = pos + 1
    return true
  }
  return false
}
