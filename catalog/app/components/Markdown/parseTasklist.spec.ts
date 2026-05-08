import type { StateInline, Token } from 'markdown-it'
import { describe, it, expect } from 'vitest'

import parseTasklist, { CheckboxContentToken } from './parseTasklist'

function createState(src: string) {
  const tokens: Token[] = []
  const level = 0
  return {
    src,
    pos: 0,
    posMax: src.length,
    level,
    tokens,
    push(type: string): Token {
      const token = { type, level } as Token
      tokens.push(token)
      return token
    },
  } as unknown as StateInline & { tokens: Token[] }
}

describe('components/Markdown/parseTasklist', () => {
  it('Detect empty checkbox', () => {
    const state = createState('[]')
    parseTasklist(state)
    expect(state.tokens).toMatchObject([{ type: 'tasklist' }])
    expect((state.tokens[0] as CheckboxContentToken).checked).toBe(false)
  })
  it('Detect empty checkbox with space inside', () => {
    const state = createState('[ ]')
    parseTasklist(state)
    expect(state.tokens).toMatchObject([{ type: 'tasklist' }])
    expect((state.tokens[0] as CheckboxContentToken).checked).toBe(false)
  })
  it('Detect checked checkbox', () => {
    const state = createState('[x]')
    parseTasklist(state)
    expect(state.tokens).toMatchObject([{ type: 'tasklist' }])
    expect((state.tokens[0] as CheckboxContentToken).checked).toBe(true)
  })
  it('Does not detect checkbox if no one', () => {
    const state = createState('foobar')
    parseTasklist(state)
    expect(state.tokens).toMatchObject([])
  })
  it('Does not detect checkbox if checkbox has two spaces', () => {
    const state = createState('[  ]')
    parseTasklist(state)
    expect(state.tokens).toMatchObject([])
  })
  it('Does not detect checkbox if checkbox has tabulation', () => {
    const state = createState(`[\t]`)
    parseTasklist(state)
    expect(state.tokens).toMatchObject([])
  })
})
