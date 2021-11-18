import * as PD from './PackageDialog'

describe('containers/Bucket/PackageDialog/PackageDialog', () => {
  describe('getUsernamePrefix', () => {
    test('should return string anyway', () => {
      expect(PD.getUsernamePrefix()).toBe('')
      expect(PD.getUsernamePrefix(null)).toBe('')
    })

    test('should return itself for usernames', () => {
      expect(PD.getUsernamePrefix('username_not-an-email')).toBe('username_notanemail/')
    })

    test('should return prefix for emails', () => {
      expect(PD.getUsernamePrefix('username@email.co.uk')).toBe('username/')
    })
  })

  describe('calcDialogHeight', () => {
    test('height should be minimal for small screen', () => {
      const metaHeight = 0
      const windowHeight = 100
      expect(PD.calcDialogHeight(windowHeight, metaHeight)).toBe(420)
    })

    test('height should fit into normal screen', () => {
      const metaHeight = 300
      const windowHeight = 768
      expect(PD.calcDialogHeight(windowHeight, metaHeight)).toBe(568)
    })

    test('height should be enough for content on large screen', () => {
      const metaHeight = 300
      const windowHeight = 1440
      expect(PD.calcDialogHeight(windowHeight, metaHeight)).toBe(645)
    })
  })

  describe('mkMetaValidator', () => {
    test('should return no error when no metadata', () => {
      expect(PD.mkMetaValidator()(null)).toBeUndefined()
    })

    test('should return error when metadata is not an object', () => {
      // TODO: remove this test when all references will be in typescript
      // @ts-expect-error
      expect(PD.mkMetaValidator()(123)).toMatchObject({
        message: 'Metadata must be a valid JSON object',
      })
    })

    test('should return no error when no Schema and metadata is object', () => {
      expect(PD.mkMetaValidator()({ any: 'thing' })).toBeUndefined()
    })

    test("should return error when metadata isn't compliant with Schema", () => {
      expect(PD.mkMetaValidator({ type: 'array' })({ any: 'thing' })).toMatchObject([
        { message: 'must be array' },
      ])
    })

    test('should return no error when metadata is compliant with Schema', () => {
      expect(
        PD.mkMetaValidator({ type: 'object', properties: { any: { type: 'string' } } })({
          any: 'thing',
        }),
      ).toBeUndefined()
    })
  })
})
