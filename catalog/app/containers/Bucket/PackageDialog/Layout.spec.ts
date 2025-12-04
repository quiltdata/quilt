import { describe, expect, it, vi } from 'vitest'

import { calcDialogHeight } from './Layout'

vi.mock('constants/config', () => ({ default: {} }))

describe('containers/Bucket/PackageDialog/Layout', () => {
  describe('calcDialogHeight', () => {
    it('height should be minimal for small screen', () => {
      const metaHeight = 0
      const windowHeight = 100
      expect(calcDialogHeight(windowHeight, metaHeight)).toBe(420)
    })

    it('height should fit into normal screen', () => {
      const metaHeight = 300
      const windowHeight = 768
      expect(calcDialogHeight(windowHeight, metaHeight)).toBe(568)
    })

    it('height should be enough for content on large screen', () => {
      const metaHeight = 300
      const windowHeight = 1440
      expect(calcDialogHeight(windowHeight, metaHeight)).toBe(645)
    })
  })
})
