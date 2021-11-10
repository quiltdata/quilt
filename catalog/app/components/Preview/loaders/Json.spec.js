import { traverseUrls } from './Json'

describe('components/Preview/loaders/Json', () => {
  describe('traverseUrls', () => {
    it('traverse urls in single data', () => {
      const spec = { data: { url: 'relative.json' } }
      const transformFn = (url) => `A${url}B`
      const expectedResult = { data: { url: 'Arelative.jsonB' } }
      expect(traverseUrls(transformFn, spec)).toEqual(expectedResult)
    })

    it('traverse urls in data array', () => {
      const spec = { data: [{ url: 'relative.json' }, { url: 'another.json' }] }
      const transformFn = (url) => `A${url}B`
      const expectedResult = {
        data: [{ url: 'Arelative.jsonB' }, { url: 'Aanother.jsonB' }],
      }
      expect(traverseUrls(transformFn, spec)).toEqual(expectedResult)
    })

    it('traverse urls in layers', () => {
      const spec = {
        layer: [{ data: { url: 'relative.json' } }, { data: { url: 'another.json' } }],
      }
      const transformFn = (url) => `A${url}B`
      const expectedResult = {
        layer: [
          { data: { url: 'Arelative.jsonB' } },
          { data: { url: 'Aanother.jsonB' } },
        ],
      }
      expect(traverseUrls(transformFn, spec)).toEqual(expectedResult)
    })
  })
})
