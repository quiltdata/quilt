import { describe, it, expect } from 'vitest'

import AsyncResult from './AsyncResult'

describe('utils/AsyncResult', () => {
  const cases = {
    Init: () => 'init',
    Pending: () => 'pending',
    Ok: (v: number) => `ok:${v}`,
    Err: (e: string) => `err:${e}`,
  }

  it('constructs and matches the four variants', () => {
    expect(AsyncResult.case(cases, AsyncResult.Init())).toBe('init')
    expect(AsyncResult.case(cases, AsyncResult.Pending())).toBe('pending')
    expect(AsyncResult.case(cases, AsyncResult.Ok(42))).toBe('ok:42')
    expect(AsyncResult.case(cases, AsyncResult.Err('boom'))).toBe('err:boom')
  })

  it('supports the `_` wildcard case', () => {
    const matched = AsyncResult.case(
      { Ok: (v: number) => v, _: () => 'other' },
      AsyncResult.Pending(),
    )
    expect(matched).toBe('other')
  })

  it('exposes per-variant `is` guards and `unbox`', () => {
    expect(AsyncResult.Ok.is(AsyncResult.Ok(1))).toBe(true)
    expect(AsyncResult.Ok.is(AsyncResult.Err(new Error('x')))).toBe(false)
    expect(AsyncResult.Ok.unbox(AsyncResult.Ok(7))).toBe(7)
  })

  it('prop() maps an Ok value to one of its fields and passes others through', () => {
    const getName = AsyncResult.prop('name')
    const mapped = getName(AsyncResult.Ok({ name: 'x' }))
    expect(AsyncResult.Ok.is(mapped)).toBe(true)
    expect(AsyncResult.Ok.unbox(mapped)).toBe('x')
    // non-Ok instances pass through unchanged
    expect(AsyncResult.Pending.is(getName(AsyncResult.Pending()))).toBe(true)
  })

  it('getPrevResult() unwraps the last Ok (through Pending), else null', () => {
    expect(AsyncResult.getPrevResult(AsyncResult.Ok(5))).toBe(5)
    expect(AsyncResult.getPrevResult(AsyncResult.Init())).toBe(null)
    expect(AsyncResult.getPrevResult(AsyncResult.Pending(AsyncResult.Ok(9)))).toBe(9)
  })
})
