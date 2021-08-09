import * as plural from './plural'

describe('utils/plural', () => {
  describe('format with full locale', () => {
    const locale = {
      zero: () => 'zero apples',
      one: () => 'one apple',
      other: (n: number) => `${n} apples`,
    }
    it('format zero', () => {
      expect(plural.format(0, locale)).toEqual('zero apples')
    })
    it('format one', () => {
      expect(plural.format(1, locale)).toEqual('one apple')
    })
    it('format any', () => {
      expect(plural.format(13, locale)).toEqual('13 apples')
    })
  })

  describe('format with insufficient locale', () => {
    const locale = {
      other: (n: number) => `${n} apples`,
    }
    it('format zero', () => {
      expect(plural.format(0, locale)).toEqual('0 apples')
    })
    it('format one', () => {
      expect(plural.format(1, locale)).toEqual('1 apples')
    })
    it('format any', () => {
      expect(plural.format(13, locale)).toEqual('13 apples')
    })
  })

  describe('format without numbers', () => {
    const locale = {
      one: () => 'apple',
      other: () => 'apples',
    }
    it('format zero', () => {
      expect(plural.format(0, locale)).toEqual('apples')
    })
    it('format one', () => {
      expect(plural.format(1, locale)).toEqual('apple')
    })
    it('format any', () => {
      expect(plural.format(13, locale)).toEqual('apples')
    })
  })
})
