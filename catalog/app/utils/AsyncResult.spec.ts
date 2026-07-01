import { Equal } from 'effect'
import { describe, it, expect } from 'vitest'

import AsyncResult, {
  ok,
  err,
  init,
  pending,
  match,
  fold,
  mapCase,
  prop,
  props,
  map,
  mapErr,
  flatMap,
  getOrElse,
  getOrNull,
  prevResult,
  isOk,
  isErr,
  isInit,
  isPending,
  is,
  Ok,
  Err,
  Init,
  Pending,
} from './AsyncResult'

describe('utils/AsyncResult', () => {
  describe('construction', () => {
    it('Ok wraps a value', () => {
      const r = ok(42)
      expect(isOk(r)).toBe(true)
      expect((r as Ok<number>).value).toBe(42)
      expect((r as Ok<number>)._tag).toBe('AsyncResult/Ok')
    })

    it('Err wraps an error payload (any value, not just Error)', () => {
      const r = err({ kind: 'gated' })
      expect(isErr(r)).toBe(true)
      expect((r as Err).value).toEqual({ kind: 'gated' })
    })

    it('Init is nullary with undefined value', () => {
      const r = init()
      expect(isInit(r)).toBe(true)
      expect((r as Init).value).toBeUndefined()
    })

    it('Pending is nullary or boxes a previous result', () => {
      expect(isPending(pending())).toBe(true)
      expect((pending() as Pending).value).toBeUndefined()
      const prev = ok(1)
      expect((pending(prev) as Pending).value).toBe(prev)
    })

    it('is() recognizes any variant and rejects non-instances', () => {
      expect(is(ok(1))).toBe(true)
      expect(is(err(1))).toBe(true)
      expect(is(init())).toBe(true)
      expect(is(pending())).toBe(true)
      expect(is({ _tag: 'AsyncResult/Ok', value: 1 })).toBe(false)
      expect(is(null)).toBe(false)
      expect(is(undefined)).toBe(false)
      expect(is(42)).toBe(false)
    })

    it('constructors are bare unary callbacks usable point-free', async () => {
      // The load-bearing `promise.then(Ok).catch(Err)` usage from utils/Data.
      const good = await Promise.resolve('v').then(AsyncResult.Ok)
      expect(isOk(good)).toBe(true)
      const bad = await Promise.reject(new Error('x'))
        .then(AsyncResult.Ok)
        .catch(AsyncResult.Err)
      expect(isErr(bad)).toBe(true)
      expect((bad as Err<Error>).value).toBeInstanceOf(Error)
    })

    it('instances have effect structural equality', () => {
      expect(Equal.equals(ok(1), ok(1))).toBe(true)
      expect(Equal.equals(ok(1), ok(2))).toBe(false)
      expect(Equal.equals(init(), init())).toBe(true)
      expect(Equal.equals(ok(1), err(1))).toBe(false)
      // nested pending equality
      expect(Equal.equals(pending(ok(1)), pending(ok(1)))).toBe(true)
    })
  })

  describe('refinements', () => {
    it('narrow to exactly one variant', () => {
      const values = [ok(1), err('e'), init(), pending()]
      expect(values.filter(isOk)).toHaveLength(1)
      expect(values.filter(isErr)).toHaveLength(1)
      expect(values.filter(isInit)).toHaveLength(1)
      expect(values.filter(isPending)).toHaveLength(1)
    })

    it('constructor .is predicates work (with optional value predicate)', () => {
      expect(AsyncResult.Ok.is(ok(5))).toBe(true)
      expect(AsyncResult.Ok.is(err(5))).toBe(false)
      expect(AsyncResult.Ok.is(ok(5), (v) => v > 3)).toBe(true)
      expect(AsyncResult.Ok.is(ok(5), (v) => v > 9)).toBe(false)
      expect(AsyncResult.Err.is(err(1))).toBe(true)
      expect(AsyncResult.Init.is(init())).toBe(true)
      expect(AsyncResult.Pending.is(pending())).toBe(true)
    })

    it('constructor .unbox extracts the payload', () => {
      expect(AsyncResult.Ok.unbox(ok(7))).toBe(7)
      expect(AsyncResult.Err.unbox(err('boom'))).toBe('boom')
    })
  })

  describe('match / case', () => {
    it('hands the UNBOXED payload to named handlers', () => {
      expect(match({ Ok: (v: number) => v * 2, _: () => 0 }, ok(21))).toBe(42)
      expect(match({ Err: (e: string) => e.toUpperCase(), _: () => '' }, err('x'))).toBe(
        'X',
      )
      expect(match({ Pending: (p) => p, _: () => 'none' }, pending())).toBeUndefined()
    })

    it('hands the RAW instance to the _ fallback', () => {
      // preserves the Render.tsx `_: (x) => x.value?.message` asymmetry
      const boom = new Error('nope')
      const msg = match(
        { Ok: (v: string) => v, _: (x) => (isErr(x) ? (x.value as Error).message : '?') },
        err(boom),
      )
      expect(msg).toBe('nope')
    })

    it('is curried when given only cases', () => {
      const render = match({ Ok: (v: number) => `ok:${v}`, _: () => 'other' })
      expect(render(ok(1))).toBe('ok:1')
      expect(render(init())).toBe('other')
    })

    it('forwards trailing extra args to the chosen handler', () => {
      // preserves the Summary.HandleResolver `Err: (e, { fetch }) => …` pattern
      const withExtra = match({
        Err: (e: string, ctx: { retry: () => string }) => `${e}:${ctx.retry()}`,
        _: () => 'n/a',
      })
      expect(withExtra(err('boom'), { retry: () => 'R' })).toBe('boom:R')
    })

    it('infers the return type as the union of handler returns', () => {
      // { Ok: () => number[], _: () => number } -> number[] | number
      const out: number[] | number = match(
        { Ok: (xs: number[]) => xs, _: () => 0 },
        ok([1, 2]),
      )
      expect(out).toEqual([1, 2])
    })

    it('throws on non-exhaustive cases', () => {
      // Only Ok provided, but instance is Err and there is no fallback.
      expect(() => match({ Ok: (v: number) => v } as any, err('x') as any)).toThrow(
        /non-exhaustive/,
      )
    })

    it('default-export .case behaves identically (loose-typed compat)', () => {
      expect(AsyncResult.case({ Ok: (v: number) => v + 1, _: () => 0 }, ok(1))).toBe(2)
    })
  })

  describe('fold (total, exhaustive)', () => {
    const f = fold<number, string, string>({
      Init: () => 'init',
      Pending: () => 'pending',
      Ok: (v) => `ok:${v}`,
      Err: (e) => `err:${e}`,
    })
    it('dispatches every variant', () => {
      expect(f(init())).toBe('init')
      expect(f(pending())).toBe('pending')
      expect(f(ok(5))).toBe('ok:5')
      expect(f(err('boom'))).toBe('err:boom')
    })
  })

  describe('combinators', () => {
    it('map transforms Ok, passes through the rest', () => {
      expect(map((n: number) => n + 1)(ok(1))).toEqual(ok(2))
      expect(map((n: number) => n + 1)(err('e'))).toEqual(err('e'))
      expect(isInit(map((n: number) => n + 1)(init()))).toBe(true)
      expect(isPending(map((n: number) => n + 1)(pending()))).toBe(true)
    })

    it('mapErr transforms Err, passes through the rest', () => {
      expect(mapErr((e: string) => e.length)(err('boom'))).toEqual(err(4))
      expect(mapErr((e: string) => e.length)(ok(1))).toEqual(ok(1))
    })

    it('flatMap chains on Ok only', () => {
      const half = (n: number) => (n % 2 === 0 ? ok(n / 2) : err('odd'))
      expect(flatMap(half)(ok(10))).toEqual(ok(5))
      expect(flatMap(half)(ok(3))).toEqual(err('odd'))
      expect(flatMap(half)(err('x'))).toEqual(err('x'))
      expect(isInit(flatMap(half)(init()))).toBe(true)
    })

    it('getOrElse / getOrNull extract the Ok value or a default', () => {
      expect(getOrElse(() => -1)(ok(9))).toBe(9)
      expect(getOrElse(() => -1)(err('e'))).toBe(-1)
      expect(getOrElse((r) => (isPending(r) ? 'p' : 'x'))(pending())).toBe('p')
      expect(getOrNull(ok(9))).toBe(9)
      expect(getOrNull(err('e'))).toBeNull()
      expect(getOrNull(init())).toBeNull()
    })
  })

  describe('mapCase (variant-scoped map, re-boxes)', () => {
    it('maps and re-wraps into the same variant', () => {
      const r = mapCase({ Ok: (v: { body: string }) => v.body }, ok({ body: 'hi' }))
      expect(r).toEqual(ok('hi'))
    })

    it('passes unlisted variants through untouched', () => {
      const m = mapCase({ Ok: (v: number) => v + 1 })
      expect(m(ok(1))).toEqual(ok(2))
      expect(m(err('e'))).toEqual(err('e'))
      expect(isInit(m(init()))).toBe(true)
    })

    it('can map multiple variants at once', () => {
      const m = mapCase({ Ok: (v: number) => v * 2, Err: (e: string) => `E:${e}` })
      expect(m(ok(3))).toEqual(ok(6))
      expect(m(err('x'))).toEqual(err('E:x'))
    })

    it('is curried and eager', () => {
      expect(mapCase({ Ok: (v: number) => v + 1 }, ok(1))).toEqual(ok(2))
      expect(mapCase({ Ok: (v: number) => v + 1 })(ok(1))).toEqual(ok(2))
    })
  })

  describe('prop / props (extract a field of the Ok value)', () => {
    const src = ok({ exts: ['a', 'b'], total: 3 })

    it('prop picks a field, staying an AsyncResult', () => {
      expect(prop('exts', src)).toEqual(ok(['a', 'b']))
      expect(prop('total', src)).toEqual(ok(3))
    })

    it('prop passes non-Ok variants through', () => {
      expect(prop('exts', err('e') as any)).toEqual(err('e'))
      expect(isInit(prop('exts', init() as any))).toBe(true)
    })

    it('prop is curried', () => {
      const getExts = prop('exts')
      expect(getExts(src)).toEqual(ok(['a', 'b']))
    })

    it('props builds a record of per-field AsyncResults', () => {
      const r = props(['exts', 'total'], src)
      expect(r.exts).toEqual(ok(['a', 'b']))
      expect(r.total).toEqual(ok(3))
    })
  })

  describe('prevResult (recurse through Pending to the last Ok)', () => {
    it('returns the Ok value directly', () => {
      expect(prevResult(ok(5))).toBe(5)
    })

    it('returns null for Init / Err / bare Pending', () => {
      expect(prevResult(init())).toBeNull()
      expect(prevResult(err('e'))).toBeNull()
      expect(prevResult(pending())).toBeNull()
    })

    it('recurses through a nested-AsyncResult Pending payload', () => {
      expect(prevResult(pending(ok(7)))).toBe(7)
      // Pending wrapping Pending wrapping Ok
      expect(prevResult(pending(pending(ok(8))))).toBe(8)
      // Pending wrapping Err -> no Ok -> null
      expect(prevResult(pending(err('e')))).toBeNull()
    })

    it('recurses through the { prev } record payload used by utils/Data', () => {
      const boxed = pending({ prev: ok(9) })
      expect(prevResult(boxed)).toBe(9)
      const deep = pending({ prev: pending({ prev: ok(10) }) })
      expect(prevResult(deep)).toBe(10)
      expect(prevResult(pending({ prev: undefined }))).toBeNull()
    })

    it('default-export getPrevResult alias matches prevResult', () => {
      expect(AsyncResult.getPrevResult(pending(ok(11)))).toBe(11)
    })
  })

  describe('legacy-compat surface (default export)', () => {
    it('Ok/Err accept a zero-arg call (legacy tagged behaviour)', () => {
      expect(isErr(AsyncResult.Err())).toBe(true)
      expect((AsyncResult.Err() as Err).value).toBeUndefined()
      expect(isOk(AsyncResult.Ok())).toBe(true)
    })

    it('.mapCase compat form tolerates a mismatched source payload type', () => {
      const anyResult: any = ok({ id: 'x' })
      const mapped = AsyncResult.mapCase({ Ok: (v: { id: string }) => v.id }, anyResult)
      expect(mapped).toEqual(ok('x'))
    })
  })
})
