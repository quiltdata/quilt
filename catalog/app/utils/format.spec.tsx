import * as Format from './format'

describe('utils/format', () => {
  describe('pluralify', () => {
    describe('format with full locale', () => {
      const locale = {
        zero: () => 'zero apples',
        one: () => 'one apple',
        other: (n: number) => `${n} apples`,
      }
      it('format zero', () => {
        expect(Format.pluralify(0, locale)).toEqual('zero apples')
      })
      it('format one', () => {
        expect(Format.pluralify(1, locale)).toEqual('one apple')
      })
      it('format any', () => {
        expect(Format.pluralify(13, locale)).toEqual('13 apples')
      })
    })

    describe('format with insufficient locale', () => {
      const locale = {
        other: (n: number) => `${n} apples`,
      }
      it('format zero', () => {
        expect(Format.pluralify(0, locale)).toEqual('0 apples')
      })
      it('format one', () => {
        expect(Format.pluralify(1, locale)).toEqual('1 apples')
      })
      it('format any', () => {
        expect(Format.pluralify(13, locale)).toEqual('13 apples')
      })
    })

    describe('format without numbers', () => {
      const locale = {
        one: () => 'apple',
        other: () => 'apples',
      }
      it('format zero', () => {
        expect(Format.pluralify(0, locale)).toEqual('apples')
      })
      it('format one', () => {
        expect(Format.pluralify(1, locale)).toEqual('apple')
      })
      it('format any', () => {
        expect(Format.pluralify(13, locale)).toEqual('apples')
      })
    })
  })

  describe('relativify', () => {
    jest.useFakeTimers('modern')
    jest.setSystemTime(new Date(2020, 0, 30, 0, 0, 0, 0))

    it('format seconds', () => {
      expect(Format.relativify(new Date(2020, 0, 29, 23, 59, 58, 0))).toEqual(
        '2 seconds ago',
      )
      expect(Format.relativify(new Date(2020, 0, 29, 23, 59, 27, 0))).toEqual(
        '33 seconds ago',
      )
    })

    it('format minutes', () => {
      expect(Format.relativify(new Date(2020, 0, 29, 23, 53, 58, 0))).toEqual(
        '6 minutes ago',
      )
      expect(Format.relativify(new Date(2020, 0, 29, 23, 53, 27, 0))).toEqual(
        '7 minutes ago',
      )
      expect(Format.relativify(new Date(2020, 0, 29, 23, 59, 0, 0))).toEqual(
        '1 minute ago',
      )
    })

    it('format hours', () => {
      expect(Format.relativify(new Date(2020, 0, 29, 8, 23, 0, 0))).toEqual(
        '16 hours ago',
      )
      expect(Format.relativify(new Date(2020, 0, 29, 8, 53, 0, 0))).toEqual(
        '15 hours ago',
      )
      expect(Format.relativify(new Date(2020, 0, 29, 23, 0, 0, 0))).toEqual('1 hour ago')
    })

    it('format days', () => {
      expect(Format.relativify(new Date(2020, 0, 16, 7, 0, 0, 0))).toEqual('14 days ago')
      expect(Format.relativify(new Date(2020, 0, 16, 17, 0, 0, 0))).toEqual('13 days ago')
      expect(Format.relativify(new Date(2020, 0, 29, 0, 0, 0, 0))).toEqual('yesterday')
    })

    it('format months', () => {
      expect(Format.relativify(new Date(2019, 10, 7, 0, 0, 0, 0))).toEqual('3 months ago')
      expect(Format.relativify(new Date(2019, 10, 17, 0, 0, 0, 0))).toEqual(
        '2 months ago',
      )
      expect(Format.relativify(new Date(2019, 12, 0, 0, 0, 0, 0))).toEqual('last month')
    })

    it('format years', () => {
      expect(Format.relativify(new Date(2009, 5, 0, 0, 0, 0, 0))).toEqual('11 years ago')
      expect(Format.relativify(new Date(2009, 10, 0, 0, 0, 0, 0))).toEqual('10 years ago')
      expect(Format.relativify(new Date(2019, 0, 0, 0, 0, 0, 0))).toEqual('last year')
    })
  })
})
