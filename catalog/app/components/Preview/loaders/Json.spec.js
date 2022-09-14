import { traverseUrls } from './Json'

describe('components/Preview/loaders/Json', () => {
  describe('traverseUrls', () => {
    const transformFn = (url) => `A${url}B`

    it('traverse urls in single data', () => {
      const spec = { data: { url: 'one.json' } }
      const expectedResult = { data: { url: 'Aone.jsonB' } }
      expect(traverseUrls(transformFn, spec)).toEqual(expectedResult)
    })

    it('traverse urls in data array', () => {
      const spec = { data: [{ url: 'one.json' }, { url: 'two.json' }] }
      const expectedResult = {
        data: [{ url: 'Aone.jsonB' }, { url: 'Atwo.jsonB' }],
      }
      expect(traverseUrls(transformFn, spec)).toEqual(expectedResult)
    })

    it('traverse urls in layers', () => {
      const spec = {
        layer: [{ data: { url: 'one.json' } }, { data: { url: 'two.json' } }],
      }
      const expectedResult = {
        layer: [{ data: { url: 'Aone.jsonB' } }, { data: { url: 'Atwo.jsonB' } }],
      }
      expect(traverseUrls(transformFn, spec)).toEqual(expectedResult)
    })
  })
})
