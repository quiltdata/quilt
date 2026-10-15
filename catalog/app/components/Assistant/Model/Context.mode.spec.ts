import { describe, expect, it, vi } from 'vitest'

import * as Context from './Context'
import type * as Tool from './Tool'

vi.mock('constants/config', () => ({ default: {} }))

const tool = (effect: Tool.Effect) => ({ effect }) as Tool.Descriptor<unknown>

const ctx = (markers: Record<string, boolean>): Context.ContextShape => ({
  messages: [],
  markers,
  tools: { read: tool('read'), write: tool('write'), rm: tool('destructive') },
})

describe('components/Assistant/Model/Context forMode', () => {
  it('offers only read tools in Ask mode', () => {
    expect(Object.keys(Context.forMode(ctx({ [Context.ASK_MODE]: true })).tools)).toEqual(
      ['read'],
    )
  })

  it('leaves every tool in Agent mode', () => {
    expect(Object.keys(Context.forMode(ctx({})).tools)).toEqual(['read', 'write', 'rm'])
  })
})
