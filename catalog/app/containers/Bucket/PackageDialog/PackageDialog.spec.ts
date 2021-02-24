import * as PD from './PackageDialog'

describe('containers/Bucket/PackageDialog/PackageDialog', () => {
  describe('useUsernamePrefix', () => {
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
})
