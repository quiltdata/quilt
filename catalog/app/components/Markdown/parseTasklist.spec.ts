import type { Remarkable } from 'remarkable'
import parseTasklist from './parseTasklist'

function createState(src: string) {
  return {
    src,
    pos: 0,
    level: 0,
    tokens: [] as Remarkable.ContentToken[],
    push(x: Remarkable.ContentToken) {
      this.tokens.push(x)
    },
  } as Remarkable.StateInline
}

const uncheckedCheckbox = {
  type: 'tasklist',
  checked: false,
  level: 0,
}
const checkedCheckbox = {
  type: 'tasklist',
  checked: true,
  level: 0,
}

describe('components/Markdown/parseTasklist', () => {
  it('Detect empty checkbox', () => {
    const state = createState('[]')
    parseTasklist(state as Remarkable.StateInline)
    expect(state.tokens).toMatchObject([uncheckedCheckbox])
  })
  it('Detect empty checkbox with space inside', () => {
    const state = createState('[ ]')
    parseTasklist(state as Remarkable.StateInline)
    expect(state.tokens).toMatchObject([uncheckedCheckbox])
  })
  it('Detect checked checkbox', () => {
    const state = createState('[x]')
    parseTasklist(state as Remarkable.StateInline)
    expect(state.tokens).toMatchObject([checkedCheckbox])
  })
  it('Does not detect checkbox if no one', () => {
    const state = createState('foobar')
    parseTasklist(state as Remarkable.StateInline)
    expect(state.tokens).toMatchObject([])
  })
  it('Does not detect checkbox if checkbox has two spaces', () => {
    const state = createState('[  ]')
    parseTasklist(state as Remarkable.StateInline)
    expect(state.tokens).toMatchObject([])
  })
  it('Does not detect checkbox if checkbox has tabulation', () => {
    const state = createState(`[\t]`)
    parseTasklist(state as Remarkable.StateInline)
    expect(state.tokens).toMatchObject([])
  })
})
