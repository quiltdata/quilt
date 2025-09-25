import { mkMetaValidator } from './schema'

jest.mock(
  'constants/config',
  jest.fn(() => ({
    registryUrl: '',
  })),
)

describe('containers/Bucket/PackageDialog/State/schema', () => {
  describe('mkMetaValidator', () => {
    it('should return no error when no metadata', () => {
      expect(mkMetaValidator()(null)).toBeUndefined()
    })

    it('should return error when metadata is not an object', () => {
      expect(mkMetaValidator()(123)).toMatchObject([
        {
          message: 'Metadata must be a valid JSON object',
        },
      ])
    })

    it('should return no error when no Schema and metadata is object', () => {
      expect(mkMetaValidator()({ any: 'thing' })).toBeUndefined()
    })

    it("should return error when metadata isn't compliant with Schema", () => {
      expect(mkMetaValidator({ type: 'array' })({ any: 'thing' })).toMatchObject([
        { message: 'must be array' },
      ])
    })

    it('should return no error when metadata is compliant with Schema', () => {
      expect(
        mkMetaValidator({ type: 'object', properties: { any: { type: 'string' } } })({
          any: 'thing',
        }),
      ).toBeUndefined()
    })
  })
})
