import * as R from 'ramda'

import * as tagged from './taggedV2'

describe('utils/taggedv2', () => {
  describe('equality check', () => {
    const Type = tagged.create('Type' as const, {
      A: (v: number) => v,
      B: () => {},
    })

    it('should return true for equal values', () => {
      const a1 = Type.A(1)
      const a11 = Type.A(1)
      expect(R.equals(a1, a11)).toBe(true)
    })
    it('should return false for different values of the same type', () => {
      const a1 = Type.A(1)
      const a2 = Type.A(2)
      expect(R.equals(a1, a2)).toBe(false)
    })
    it('should return false for different values of different types', () => {
      const a1 = Type.A(1)
      const b = Type.B()
      expect(R.equals(a1 as any, b as any)).toBe(false)
    })
  })

  describe('.is', () => {
    const Type = tagged.create('Type' as const, {
      A: (v: number) => v,
      B: () => {},
    })

    const Type2 = tagged.create('Type2' as const, {
      A: (v: number) => v,
      B: () => {},
    })

    it('should return true if the argument is an instance of the given type', () => {
      expect(Type.is(Type.A(1))).toBe(true)
      expect(Type.is(Type.B())).toBe(true)
    })
    it('should return false if the argument is not an instance of the given type', () => {
      expect(Type.is(null)).toBe(false)
      expect(Type.is(Type2.A(1))).toBe(false)
    })
  })

  describe('Constructor.is', () => {
    const Type = tagged.create('Type' as const, {
      A: (v: number) => v,
      B: () => {},
    })

    it('should return true if the argument is an instance of the given variant', () => {
      expect(Type.A.is(Type.A(1))).toBe(true)
    })
    it('should return false if the argument is not an instance of the given type / variant', () => {
      expect(Type.A.is(Type.B())).toBe(false)
      expect(Type.A.is(null)).toBe(false)
    })
  })

  describe('Constructor.unbox', () => {
    const Type = tagged.create('Type' as const, {
      A: (v: number) => v,
      B: () => {},
    })

    it('should return the boxed value if the argument is an instance of the given variant', () => {
      expect(Type.A.unbox(Type.A(1))).toBe(1)
    })
    it('should not typecheck if the argument is not an instance of the given variant', () => {
      // @ts-expect-error
      Type.A.unbox(Type.B())
      // @ts-expect-error
      expect(() => Type.A.unbox(null)).toThrow()
    })
  })

  describe('match', () => {
    const Result = tagged.create('Result' as const, {
      Ok: (v: string) => v,
      Err: (v: string) => v,
    })
    const ok = Result.Ok('ok')
    const err = Result.Err('err')

    describe('exhaustive', () => {
      const match = Result.match({
        Ok: (v) => `ok: ${v}`,
        Err: (e) => `err: ${e}`,
      })

      it('should work', () => {
        expect(match(ok)).toBe('ok: ok')
        expect(match(err)).toBe('err: err')
      })

      it('should not typecheck', () => {
        // @ts-expect-error
        expect(() => match('sup')).toThrow()
      })
    })

    describe('non-exhaustive', () => {
      it('should not typecheck', () => {
        // @ts-expect-error
        Result.match({ Ok: (v) => v })
      })
    })

    describe('with catch-all (_)', () => {
      const match = Result.match({
        Ok: (v) => v,
        _: () => 'catch-all',
      })

      it('should work', () => {
        expect(match(ok)).toBe('ok')
        expect(match(err)).toBe('catch-all')
      })
    })

    describe('with extra arguments', () => {
      const cases = {
        Ok: (val: string, ...rest: [number, number]) => [val, ...rest],
        _: () => ['catch-all', 0, 0],
      }

      const args = [1, 2] as const

      const expected = ['ok', ...args] as const

      it('should work', () => {
        expect(Result.match(cases, ok, ...args)).toEqual(expected)
        expect(Result.match(cases)(ok, ...args)).toEqual(expected)
      })
    })
  })
})
