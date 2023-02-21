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

describe('components/Markdown/parseTasklist', () => {
  it('Detect empty checkbox', () => {
    const state = createState('[]')
    parseTasklist(state as Remarkable.StateInline)
    expect(state.tokens).toMatchObject([
      {
        type: 'tasklist',
        checked: false,
        level: 0,
      },
    ])
  })
  it('Detect empty checkbox with space inside', () => {
    const state = {
      src: '[ ]',
      pos: 0,
      level: 0,
      tokens: [] as Remarkable.ContentToken[],
      push(x: Remarkable.ContentToken) {
        this.tokens.push(x)
      },
    }
    parseTasklist(state as Remarkable.StateInline)
    expect(state.tokens).toMatchObject([
      {
        type: 'tasklist',
        checked: false,
        level: 0,
      },
    ])
  })
  it('Detect checked checkbox', () => {
    const state = {
      src: '[x]',
      pos: 0,
      level: 0,
      tokens: [] as Remarkable.ContentToken[],
      push(x: Remarkable.ContentToken) {
        this.tokens.push(x)
      },
    }
    parseTasklist(state as Remarkable.StateInline)
    expect(state.tokens).toMatchObject([
      {
        type: 'tasklist',
        checked: true,
        level: 0,
      },
    ])
  })
  it('Does not detect checkbox if no one', () => {
    const state = {
      src: 'foobar',
      pos: 0,
      level: 0,
      tokens: [] as Remarkable.ContentToken[],
      push(x: Remarkable.ContentToken) {
        this.tokens.push(x)
      },
    }
    parseTasklist(state as Remarkable.StateInline)
    expect(state.tokens).toMatchObject([])
  })
})
