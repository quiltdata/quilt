import { describe, it, expect } from 'vitest'

import { getArchiveState } from './glacier'

describe('utils/glacier', () => {
  describe('getArchiveState (from HEAD x-amz-restore header)', () => {
    describe('restore (parsing x-amz-restore)', () => {
      it('is undefined for missing / empty / malformed header', () => {
        expect(getArchiveState('GLACIER', undefined).restore).toBeUndefined()
        expect(getArchiveState('GLACIER', '').restore).toBeUndefined()
        expect(getArchiveState('GLACIER', 'garbage').restore).toBeUndefined()
      })

      it('parses ongoing-request="true"', () => {
        expect(getArchiveState('GLACIER', 'ongoing-request="true"').restore).toEqual({
          ongoing: true,
        })
      })

      it('parses ongoing-request="false" with expiry-date', () => {
        const { restore } = getArchiveState(
          'GLACIER',
          'ongoing-request="false", expiry-date="Fri, 21 Dec 2012 00:00:00 GMT"',
        )
        expect(restore?.ongoing).toBe(false)
        expect(restore?.expiresAt?.toISOString()).toBe('2012-12-21T00:00:00.000Z')
      })

      it('is ongoing=false without expiresAt when expiry-date is missing/malformed', () => {
        expect(getArchiveState('GLACIER', 'ongoing-request="false"').restore).toEqual({
          ongoing: false,
        })
        expect(
          getArchiveState('GLACIER', 'ongoing-request="false", expiry-date="nope"')
            .restore,
        ).toEqual({ ongoing: false })
      })
    })

    describe('archived (classification)', () => {
      it('is false for non-archive storage classes', () => {
        expect(getArchiveState('STANDARD', undefined).archived).toBe(false)
        expect(getArchiveState(undefined, undefined).archived).toBe(false)
      })

      it('is true for GLACIER / DEEP_ARCHIVE with no or ongoing restore', () => {
        expect(getArchiveState('GLACIER', undefined).archived).toBe(true)
        expect(getArchiveState('DEEP_ARCHIVE', undefined).archived).toBe(true)
        expect(getArchiveState('GLACIER', 'ongoing-request="true"').archived).toBe(true)
      })

      it('is false with a live restored copy (future expiry)', () => {
        const future = new Date('2099-01-01T00:00:00Z').toUTCString()
        expect(
          getArchiveState('GLACIER', `ongoing-request="false", expiry-date="${future}"`)
            .archived,
        ).toBe(false)
      })

      it('is true with an expired restored copy (past expiry)', () => {
        const past = new Date('2001-01-01T00:00:00Z').toUTCString()
        expect(
          getArchiveState('GLACIER', `ongoing-request="false", expiry-date="${past}"`)
            .archived,
        ).toBe(true)
      })
    })
  })

  describe('getArchiveState (from LIST RestoreStatus element)', () => {
    it('has no restore when absent / unrestored', () => {
      expect(getArchiveState('GLACIER', undefined).restore).toBeUndefined()
      expect(getArchiveState('GLACIER', {}).restore).toBeUndefined()
    })

    it('maps an in-progress restore (archived)', () => {
      const { restore, archived } = getArchiveState('GLACIER', {
        IsRestoreInProgress: true,
      })
      expect(restore).toEqual({ ongoing: true })
      expect(archived).toBe(true)
    })

    it('maps a completed restore with future expiry (not archived)', () => {
      const expiry = new Date('2099-01-01T00:00:00Z')
      const { restore, archived } = getArchiveState('GLACIER', {
        IsRestoreInProgress: false,
        RestoreExpiryDate: expiry,
      })
      expect(restore).toEqual({ ongoing: false, expiresAt: expiry })
      expect(archived).toBe(false)
    })

    it('is not archived for a non-archive storage class', () => {
      expect(getArchiveState('STANDARD', undefined).archived).toBe(false)
    })
  })
})
