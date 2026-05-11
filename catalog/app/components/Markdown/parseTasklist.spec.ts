import type { StateInline, Token } from 'markdown-it'
import { describe, it, expect } from 'vitest'

import * as tasklist from './parseTasklist'

function createState(src: string, pos = 0) {
  const tokens: Token[] = []
  const level = 0
  return {
    src,
    pos,
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
    tasklist.parse(state)
    expect(state.tokens).toMatchObject([{ type: tasklist.UNCHECKED }])
  })
  it('Detect empty checkbox with space inside', () => {
    const state = createState('[ ]')
    tasklist.parse(state)
    expect(state.tokens).toMatchObject([{ type: tasklist.UNCHECKED }])
  })
  it('Detect checked checkbox', () => {
    const state = createState('[x]')
    tasklist.parse(state)
    expect(state.tokens).toMatchObject([{ type: tasklist.CHECKED }])
  })
  it('Detect checked checkbox with uppercase X', () => {
    const state = createState('[X]')
    tasklist.parse(state)
    expect(state.tokens).toMatchObject([{ type: tasklist.CHECKED }])
  })
  it('Does not detect checkbox if no one', () => {
    const state = createState('foobar')
    tasklist.parse(state)
    expect(state.tokens).toMatchObject([])
  })
  it('Does not detect checkbox if checkbox has two spaces', () => {
    const state = createState('[  ]')
    tasklist.parse(state)
    expect(state.tokens).toMatchObject([])
  })
  it('Does not detect checkbox if checkbox has tabulation', () => {
    const state = createState(`[\t]`)
    tasklist.parse(state)
    expect(state.tokens).toMatchObject([])
  })
  it('Detects checkbox after whitespace', () => {
    const state = createState('a [x]', 2)
    tasklist.parse(state)
    expect(state.tokens).toMatchObject([{ type: tasklist.CHECKED }])
  })
  it('Does not detect checkbox mid-word', () => {
    const state = createState('a[x]b', 1)
    tasklist.parse(state)
    expect(state.tokens).toMatchObject([])
  })
})
