import { describe, it, expect } from 'vitest'

import { getArchiveState } from './glacier'

describe('utils/glacier', () => {
  describe('getArchiveState (from HEAD x-amz-restore header)', () => {
    describe('restoring (in-progress flag)', () => {
      it('is false for missing / empty / malformed header', () => {
        expect(getArchiveState('GLACIER', undefined).restoring).toBe(false)
        expect(getArchiveState('GLACIER', '').restoring).toBe(false)
        expect(getArchiveState('GLACIER', 'garbage').restoring).toBe(false)
      })

      it('is true for ongoing-request="true"', () => {
        expect(getArchiveState('GLACIER', 'ongoing-request="true"').restoring).toBe(true)
      })

      it('is false for a completed restore (ongoing-request="false")', () => {
        expect(
          getArchiveState(
            'GLACIER',
            'ongoing-request="false", expiry-date="Fri, 21 Dec 2012 00:00:00 GMT"',
          ).restoring,
        ).toBe(false)
      })
    })

    describe('archived (effective tier, or false)', () => {
      it('is false for non-archive storage classes', () => {
        expect(getArchiveState('STANDARD', undefined).archived).toBe(false)
        expect(getArchiveState(undefined, undefined).archived).toBe(false)
      })

      it('returns the tier for GLACIER / DEEP_ARCHIVE with no or ongoing restore', () => {
        expect(getArchiveState('GLACIER', undefined).archived).toBe('GLACIER')
        expect(getArchiveState('DEEP_ARCHIVE', undefined).archived).toBe('DEEP_ARCHIVE')
        expect(getArchiveState('GLACIER', 'ongoing-request="true"').archived).toBe(
          'GLACIER',
        )
      })

      it('is false with a live restored copy (future expiry)', () => {
        const future = new Date('2099-01-01T00:00:00Z').toUTCString()
        expect(
          getArchiveState('GLACIER', `ongoing-request="false", expiry-date="${future}"`)
            .archived,
        ).toBe(false)
      })

      it('returns the tier with an expired restored copy (past expiry)', () => {
        const past = new Date('2001-01-01T00:00:00Z').toUTCString()
        expect(
          getArchiveState('GLACIER', `ongoing-request="false", expiry-date="${past}"`)
            .archived,
        ).toBe('GLACIER')
      })
    })
  })

  describe('getArchiveState (from LIST RestoreStatus element)', () => {
    it('is not restoring when absent / unrestored', () => {
      expect(getArchiveState('GLACIER', undefined).restoring).toBe(false)
      expect(getArchiveState('GLACIER', {}).restoring).toBe(false)
    })

    it('maps an in-progress restore (restoring + archived)', () => {
      const { restoring, archived } = getArchiveState('GLACIER', {
        IsRestoreInProgress: true,
      })
      expect(restoring).toBe(true)
      expect(archived).toBe('GLACIER')
    })

    it('maps a completed restore with future expiry (not restoring, not archived)', () => {
      const expiry = new Date('2099-01-01T00:00:00Z')
      const { restoring, archived } = getArchiveState('GLACIER', {
        IsRestoreInProgress: false,
        RestoreExpiryDate: expiry,
      })
      expect(restoring).toBe(false)
      expect(archived).toBe(false)
    })
    // `archived` classification is source-independent (runs on the parsed
    // `restore`); the storage-class matrix is covered by the HEAD section above.
  })
})
