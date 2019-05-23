import { BaseError, ErrorDisplay } from 'utils/error'

describe('utils/error', () => {
  describe('BaseError', () => {
    describe('instance', () => {
      const e = new BaseError('test', { prop: 'test' })

      it('should be ok', () => {
        expect(e).toEqual(expect.any(Error))
        expect(e).toEqual(expect.any(BaseError))
        expect(e.name).toBe('BaseError')
        expect(e.message).toBe('test')
        expect(e.prop).toBe('test')
        expect(e.stack).toEqual(expect.stringContaining(__filename))
        expect(e.stack).not.toEqual(expect.stringContaining('new BaseError'))
      })
    })

    describe('subclass without constructor', () => {
      class SpecificError extends BaseError {
        static displayName = 'SpecificError'
      }

      const e = new SpecificError('test', { prop: 'test' })

      it('should be ok', () => {
        expect(e).toEqual(expect.any(Error))
        expect(e).toEqual(expect.any(BaseError))
        expect(e).toEqual(expect.any(SpecificError))
        expect(e.name).toBe('SpecificError')
        expect(e.message).toBe('test')
        expect(e.prop).toBe('test')
        expect(e.stack).toEqual(expect.stringContaining(__filename))
        expect(e.stack).not.toEqual(expect.stringContaining('new SpecificError'))
      })
    })

    describe('subclass with constructor', () => {
      class SpecificError extends BaseError {
        static displayName = 'SpecificError'

        constructor(data) {
          super('message', { data })
        }
      }

      const e = new SpecificError('test')

      it('should be ok', () => {
        expect(e).toEqual(expect.any(Error))
        expect(e).toEqual(expect.any(BaseError))
        expect(e).toEqual(expect.any(SpecificError))
        expect(e.name).toBe('SpecificError')
        expect(e.message).toBe('message')
        expect(e.data).toBe('test')
        expect(e.stack).toEqual(expect.stringContaining(__filename))
        expect(e.stack).not.toEqual(expect.stringContaining('new SpecificError'))
      })
    })
  })

  describe('ErrorDisplay', () => {
    it('instance should spread properly', () => {
      const expected = {
        headline: 'headline',
        detail: 'detail',
        object: { a: 1 },
      }
      const ed = new ErrorDisplay(expected.headline, expected.detail, expected.object)
      expect({ ...ed }).toEqual(expected)
    })
  })
})
