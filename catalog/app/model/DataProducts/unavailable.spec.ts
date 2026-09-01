import { describe, expect, it } from 'vitest'

import type { UnavailableReason } from './types'
import { UNAVAILABLE, reasonFor } from './unavailable'

const ALL: UnavailableReason[] = [
  'EMPTY',
  'NOT_FOUND',
  'NOT_A_MEMBER',
  'REGISTRY_UNREADABLE',
]

describe('model/DataProducts/unavailable', () => {
  describe('the four states stay four', () => {
    it('gives every reason its own title and body', () => {
      // The whole point of this module. A later "simplification" that reuses one
      // message for two reasons fails here, which is the cheapest place to
      // catch it.
      const titles = ALL.map((r) => UNAVAILABLE[r].title)
      const bodies = ALL.map((r) => UNAVAILABLE[r].body)
      expect(new Set(titles).size).toBe(ALL.length)
      expect(new Set(bodies).size).toBe(ALL.length)
    })

    it('routes the two access denials to different people', () => {
      // These are the pair most tempting to merge, and the reason not to: one is
      // a catalog grant, the other a bucket policy. Verified as distinct layers
      // -- the same AWS admin credential got AccessDenied on one DataZone
      // project and succeeded on another (raja-poc research §2).
      const member = UNAVAILABLE.NOT_A_MEMBER.remedy
      const registry = UNAVAILABLE.REGISTRY_UNREADABLE.remedy
      expect(member).not.toBe(registry)
      expect(member).toMatch(/catalog admin/i)
      expect(registry).toMatch(/storage admin/i)
    })

    it('marks only the access denials as governed', () => {
      // Governed states are normal in a product built on per-bucket permissions,
      // so they must not render as errors. NOT_FOUND is a real fault; EMPTY is
      // neither.
      expect(UNAVAILABLE.NOT_A_MEMBER.governed).toBe(true)
      expect(UNAVAILABLE.REGISTRY_UNREADABLE.governed).toBe(true)
      expect(UNAVAILABLE.NOT_FOUND.governed).toBe(false)
      expect(UNAVAILABLE.EMPTY.governed).toBe(false)
    })

    it('offers no remedy for an empty product', () => {
      // An empty package is a real thing to publish. Inventing a remedy would
      // send someone to an admin who can do nothing.
      expect(UNAVAILABLE.EMPTY.remedy).toBeNull()
    })

    it('does not tell a reader to request access when no grant would help', () => {
      // NOT_FOUND means the target was never published. "Request access" would
      // send them to an admin who finds nothing wrong on their side.
      expect(UNAVAILABLE.NOT_FOUND.remedy).not.toMatch(/access/i)
      expect(UNAVAILABLE.NOT_FOUND.remedy).toMatch(/publish/i)
    })
  })

  describe('register', () => {
    it('stays in the instrument register', () => {
      // "Oops" was scored off-register twice in design critique, and exclamation
      // marks are marketing energy inside an authenticated work session.
      for (const reason of ALL) {
        const { title, body, remedy } = UNAVAILABLE[reason]
        const text = [title, body, remedy].filter(Boolean).join(' ')
        expect(text).not.toMatch(/oops|sorry|whoops|!/i)
      }
    })
  })

  describe('reasonFor', () => {
    it('says nothing when contents are available', () => {
      expect(reasonFor('PACKAGE', undefined)).toBeNull()
      expect(reasonFor('CATALOG', 'NOT_FOUND')).toBeNull()
    })

    it('falls back to EMPTY rather than inventing a denial', () => {
      // Deliberately the wrong-but-harmless default: claiming "no files" about a
      // restricted product accuses nobody, whereas defaulting to a permission
      // story invents a denial that may not exist.
      expect(reasonFor('UNAVAILABLE', undefined)).toBe(UNAVAILABLE.EMPTY)
    })

    it('returns the stated reason', () => {
      expect(reasonFor('UNAVAILABLE', 'REGISTRY_UNREADABLE')).toBe(
        UNAVAILABLE.REGISTRY_UNREADABLE,
      )
    })
  })
})
