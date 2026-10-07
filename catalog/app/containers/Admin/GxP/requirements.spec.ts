import { describe, expect, it } from 'vitest'

import { REQUIREMENTS, displayedAssessment, liveCheck } from './requirements'

const byId = (id: string) => REQUIREMENTS.find((r) => r.id === id)!

describe('containers/Admin/GxP/requirements', () => {
  describe('liveCheck', () => {
    it('is null for requirements without a canary', () => {
      expect(liveCheck(byId('PQ-1'), [])).toBe(null)
    })

    it('is unavailable when status monitoring is off', () => {
      expect(liveCheck(byId('OQ-1'), null)).toBe('unavailable')
    })

    it('matches the canary regardless of stack prefix', () => {
      const canaries = [
        { name: 'qxp-ctlg-bucket-ac', ok: true },
        { name: 'qxp-ctlg-uri', ok: false },
        { name: 'qxp-ctlg-pkg-create', ok: null },
      ]
      expect(liveCheck(byId('OQ-1'), canaries)).toBe('pass')
      expect(liveCheck(byId('OQ-2'), canaries)).toBe('fail')
      expect(liveCheck(byId('OQ-3'), canaries)).toBe('running')
      expect(liveCheck(byId('OQ-4'), canaries)).toBe('missing')
    })
  })

  it('treats an ambiguous canary match as missing', () => {
    const canaries = [
      { name: 'a-ctlg-uri', ok: true },
      { name: 'b-ctlg-uri', ok: true },
    ]
    expect(liveCheck(byId('OQ-2'), canaries)).toBe('missing')
  })

  describe('displayedAssessment', () => {
    it('does not show a canary-backed row as supported when the canary is absent', () => {
      expect(displayedAssessment(byId('OQ-1'), 'unavailable')).toBe('notEnabled')
      expect(displayedAssessment(byId('OQ-1'), 'missing')).toBe('notEnabled')
    })

    it('keeps the static assessment when the check runs', () => {
      expect(displayedAssessment(byId('OQ-1'), 'fail')).toBe('supported')
      expect(displayedAssessment(byId('DI-2'), null)).toBe('gap')
    })
  })

  it('never presents PQ as satisfied by Quilt', () => {
    expect(byId('PQ-1').assessment).toBe('customer')
  })
})
