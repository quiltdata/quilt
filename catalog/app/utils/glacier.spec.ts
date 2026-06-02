import { describe, it, expect } from 'vitest'

import { parseRestoreHeader, isEffectivelyArchived, parseRestoreStatus } from './glacier'

describe('utils/glacier', () => {
  describe('parseRestoreHeader', () => {
    it('returns undefined for missing value', () => {
      expect(parseRestoreHeader(undefined)).toBeUndefined()
      expect(parseRestoreHeader('')).toBeUndefined()
    })

    it('returns undefined for malformed value', () => {
      expect(parseRestoreHeader('garbage')).toBeUndefined()
      expect(
        parseRestoreHeader('expiry-date="Fri, 21 Dec 2012 00:00:00 GMT"'),
      ).toBeUndefined()
    })

    it('parses ongoing-request="true"', () => {
      expect(parseRestoreHeader('ongoing-request="true"')).toEqual({ ongoing: true })
    })

    it('parses ongoing-request="false" with expiry-date', () => {
      const result = parseRestoreHeader(
        'ongoing-request="false", expiry-date="Fri, 21 Dec 2012 00:00:00 GMT"',
      )
      expect(result?.ongoing).toBe(false)
      expect(result?.expiresAt).toBeInstanceOf(Date)
      expect(result?.expiresAt?.toISOString()).toBe('2012-12-21T00:00:00.000Z')
    })

    it('returns ongoing=false without expiresAt when expiry-date is missing', () => {
      expect(parseRestoreHeader('ongoing-request="false"')).toEqual({ ongoing: false })
    })

    it('returns ongoing=false without expiresAt for malformed expiry-date', () => {
      expect(
        parseRestoreHeader('ongoing-request="false", expiry-date="not-a-date"'),
      ).toEqual({ ongoing: false })
    })
  })

  describe('isEffectivelyArchived', () => {
    it('returns false for non-archive storage classes', () => {
      expect(isEffectivelyArchived('STANDARD', undefined)).toBe(false)
      expect(isEffectivelyArchived(undefined, undefined)).toBe(false)
    })

    it('returns true for archived storage class with no restore', () => {
      expect(isEffectivelyArchived('GLACIER', undefined)).toBe(true)
      expect(isEffectivelyArchived('DEEP_ARCHIVE', undefined)).toBe(true)
    })

    it('returns true for archived storage class with ongoing restore', () => {
      expect(isEffectivelyArchived('GLACIER', { ongoing: true })).toBe(true)
    })

    it('returns false for archived storage class with live restored copy', () => {
      const future = new Date('2099-01-01T00:00:00Z')
      expect(
        isEffectivelyArchived('GLACIER', { ongoing: false, expiresAt: future }),
      ).toBe(false)
    })

    it('returns true for archived storage class with expired restored copy', () => {
      const past = new Date('2001-01-01T00:00:00Z')
      expect(isEffectivelyArchived('GLACIER', { ongoing: false, expiresAt: past })).toBe(
        true,
      )
    })

    it('returns true when ongoing=false but no expiresAt (defensive)', () => {
      expect(isEffectivelyArchived('GLACIER', { ongoing: false })).toBe(true)
    })
  })

  describe('parseRestoreStatus', () => {
    it('returns undefined when absent or unrestored', () => {
      expect(parseRestoreStatus(undefined)).toBeUndefined()
      expect(parseRestoreStatus({})).toBeUndefined()
    })

    it('maps in-progress restore', () => {
      expect(parseRestoreStatus({ IsRestoreInProgress: true })).toEqual({
        ongoing: true,
      })
    })

    it('maps a completed restore with expiry', () => {
      const expiry = new Date('2099-01-01T00:00:00Z')
      expect(
        parseRestoreStatus({ IsRestoreInProgress: false, RestoreExpiryDate: expiry }),
      ).toEqual({ ongoing: false, expiresAt: expiry })
    })
  })
})
