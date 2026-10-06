import { describe, expect, it } from 'vitest'

import { REQUIREMENTS, liveCheck } from './requirements'

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

  it('never presents PQ as satisfied by Quilt', () => {
    expect(byId('PQ-1').assessment).toBe('customer')
  })
})
