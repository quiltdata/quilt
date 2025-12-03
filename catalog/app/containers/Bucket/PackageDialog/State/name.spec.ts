import { vi } from 'vitest'
import { getUsernamePrefix } from './name'

vi.mock('constants/config', () => ({
  registryUrl: '',
}))

describe('containers/Bucket/PackageDialog/State/name', () => {
  describe('getUsernamePrefix', () => {
    it('should return string anyway', () => {
      expect(getUsernamePrefix()).toBe('')
      expect(getUsernamePrefix(null)).toBe('')
    })

    it('should return itself for usernames', () => {
      expect(getUsernamePrefix('username_not-an-email')).toBe('username_notanemail/')
    })

    it('should return prefix for emails', () => {
      expect(getUsernamePrefix('username@email.co.uk')).toBe('username/')
    })
  })
})
