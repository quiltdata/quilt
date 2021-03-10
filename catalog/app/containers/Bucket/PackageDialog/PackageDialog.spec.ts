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
      expect(PD.calcDialogHeight(windowHeight, metaHeight)).toBe(700)
    })
  })
})
