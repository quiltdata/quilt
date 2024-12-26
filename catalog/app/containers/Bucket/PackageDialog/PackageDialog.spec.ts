import * as PD from './PackageDialog'

jest.mock(
  'constants/config',
  jest.fn(() => ({
    registryUrl: '',
  })),
)

describe('containers/Bucket/PackageDialog/PackageDialog', () => {
  describe('getUsernamePrefix', () => {
    it('should return string anyway', () => {
      expect(PD.getUsernamePrefix()).toBe('')
      expect(PD.getUsernamePrefix(null)).toBe('')
    })

    it('should return itself for usernames', () => {
      expect(PD.getUsernamePrefix('username_not-an-email')).toBe('username_notanemail/')
    })

    it('should return prefix for emails', () => {
      expect(PD.getUsernamePrefix('username@email.co.uk')).toBe('username/')
    })
  })

  describe('calcDialogHeight', () => {
    it('height should be minimal for small screen', () => {
      const metaHeight = 0
      const windowHeight = 100
      expect(PD.calcDialogHeight(windowHeight, metaHeight)).toBe(420)
    })

    it('height should fit into normal screen', () => {
      const metaHeight = 300
      const windowHeight = 768
      expect(PD.calcDialogHeight(windowHeight, metaHeight)).toBe(568)
    })

    it('height should be enough for content on large screen', () => {
      const metaHeight = 300
      const windowHeight = 1440
      expect(PD.calcDialogHeight(windowHeight, metaHeight)).toBe(645)
    })
  })

  describe('mkMetaValidator', () => {
    it('should return no error when no metadata', () => {
      expect(PD.mkMetaValidator()(null)).toBeUndefined()
    })

    it('should return error when metadata is not an object', () => {
      // @ts-expect-error
      expect(PD.mkMetaValidator()(123)).toMatchObject({
        message: 'Metadata must be a valid JSON object',
      })
    })

    it('should return no error when no Schema and metadata is object', () => {
      expect(PD.mkMetaValidator()({ any: 'thing' })).toBeUndefined()
    })

    it("should return error when metadata isn't compliant with Schema", () => {
      expect(PD.mkMetaValidator({ type: 'array' })({ any: 'thing' })).toMatchObject([
        { message: 'must be array' },
      ])
    })

    it('should return no error when metadata is compliant with Schema', () => {
      expect(
        PD.mkMetaValidator({ type: 'object', properties: { any: { type: 'string' } } })({
          any: 'thing',
        }),
      ).toBeUndefined()
    })
  })
})
