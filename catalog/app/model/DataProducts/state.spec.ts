import { describe, expect, it } from 'vitest'

import {
  type Face,
  type SubscriptionState,
  deriveState,
  grantIsPresent,
  holdingSummary,
  isDisagreement,
  mayHaveLiveGrant,
  stateCopy,
} from './state'
import type { Decision, GrantStatus, Subscription } from './types'

/**
 * Subscriptions are hand-built here, never taken from `fixtures`.
 *
 * A fixture that happens to satisfy an invariant proves nothing about the
 * derivation: it proves that one row was written correctly. These cases enumerate
 * the (decision x grant x failure) combinations directly, so a change to
 * `deriveState` cannot pass by virtue of the fixture set being narrow.
 */

const AT = new Date('2026-09-15T12:00:00.000Z')
const EARLIER = new Date('2026-09-14T09:00:00.000Z')

const sub = (over: Partial<Subscription> = {}): Subscription => ({
  id: 'sub-1',
  volumeId: 'fixture-vol',
  subscriber: { name: 'fixture-ws-b' },
  requestedBy: 'a.person',
  requestedAt: EARLIER,
  decision: null,
  grant: { status: 'ABSENT', at: AT },
  lastFailure: null,
  ...over,
})

const decision = (kind: Decision['kind'], reason?: string): Decision => ({
  kind,
  by: 'a.publisher',
  at: AT,
  exchange: 'local',
  reason,
})

const withGrant = (status: GrantStatus, over: Partial<Subscription> = {}) =>
  sub({ grant: { status, at: AT }, ...over })

const failure = { at: AT, cause: 'GrantPermissions: EntityNotFoundException' }

describe('model/DataProducts/state', () => {
  describe('deriveState', () => {
    describe('the agreeing states', () => {
      it('is PENDING with no decision and no grant', () => {
        expect(deriveState(sub(), 'publisher')).toBe('PENDING')
        expect(deriveState(sub(), 'subscriber')).toBe('PENDING')
      })

      it('is APPROVED when the decision approves and the grant reads back present', () => {
        const s = withGrant('PRESENT', { decision: decision('APPROVE') })
        expect(deriveState(s, 'publisher')).toBe('APPROVED')
        expect(deriveState(s, 'subscriber')).toBe('APPROVED')
      })

      it('is REJECTED when the decision rejects and no grant is present', () => {
        const s = withGrant('ABSENT', { decision: decision('REJECT', 'not consented') })
        expect(deriveState(s, 'publisher')).toBe('REJECTED')
        expect(deriveState(s, 'subscriber')).toBe('REJECTED')
      })

      it('is REVOKED when the decision revokes and the grant is gone', () => {
        const s = withGrant('ABSENT', { decision: decision('REVOKE') })
        expect(deriveState(s, 'publisher')).toBe('REVOKED')
        expect(deriveState(s, 'subscriber')).toBe('REVOKED')
      })
    })

    /**
     * The load-bearing case. DEC-42 stores no approval state, so a screen that
     * read the decision alone would produce a confident APPROVED from a read-back
     * that never answered -- exactly the lie R5 exists to prevent.
     */
    describe('an unreadable grant wins over any decision', () => {
      const cases: Array<[string, Subscription]> = [
        ['an approve', withGrant('UNREAD', { decision: decision('APPROVE') })],
        ['a reject', withGrant('UNREAD', { decision: decision('REJECT') })],
        ['a revoke', withGrant('UNREAD', { decision: decision('REVOKE') })],
        ['no decision', withGrant('UNREAD')],
        [
          'an approve with a recorded failure',
          withGrant('UNREAD', { decision: decision('APPROVE'), lastFailure: failure }),
        ],
      ]

      it.each(cases)('is UNKNOWN, never a concrete state, with %s', (_label, s) => {
        for (const face of ['publisher', 'subscriber'] as Face[]) {
          const state = deriveState(s, face)
          expect(state).toBe('UNKNOWN')
          // Stated as an exclusion as well as an equality: the failure worth
          // catching is a refactor that returns APPROVED here, and asserting the
          // absence of every concrete state says why UNKNOWN is required.
          expect(state).not.toBe('APPROVED')
          expect(state).not.toBe('REJECTED')
          expect(state).not.toBe('REVOKED')
          expect(state).not.toBe('PENDING')
        }
      })
    })

    /**
     * The face split. One row, two readings: the publisher can retry a failed
     * grant write, the subscriber cannot and must not be shown a cause that may
     * name Lake Formation internals.
     */
    describe('a recorded failure reads differently per face', () => {
      it('is APPROVAL_FAILED to the publisher and PENDING to the subscriber, with no decision', () => {
        const s = withGrant('ABSENT', { lastFailure: failure })
        expect(deriveState(s, 'publisher')).toBe('APPROVAL_FAILED')
        expect(deriveState(s, 'subscriber')).toBe('PENDING')
      })

      it('is APPROVAL_FAILED to the publisher and PENDING to the subscriber, with an approve recorded', () => {
        const s = withGrant('ABSENT', {
          decision: decision('APPROVE'),
          lastFailure: failure,
        })
        expect(deriveState(s, 'publisher')).toBe('APPROVAL_FAILED')
        expect(deriveState(s, 'subscriber')).toBe('PENDING')
      })

      it('is REVOKE_FAILED to the publisher and APPROVED to the subscriber', () => {
        // The grant is still there, so the subscriber can still read. Telling them
        // access was removed would be false.
        const s = withGrant('PRESENT', {
          decision: decision('REVOKE'),
          lastFailure: failure,
        })
        expect(deriveState(s, 'publisher')).toBe('REVOKE_FAILED')
        expect(deriveState(s, 'subscriber')).toBe('APPROVED')
      })
    })

    /**
     * Disagreements with no recorded failure. Distinct from the cases above: here
     * nobody attempted-and-failed, so there is nothing to retry, and the fact is
     * the audit's. Collapsing either into PENDING or APPROVED is the failure.
     */
    describe('record and grant disagree with no failure recorded', () => {
      it('is APPROVED_GRANT_MISSING for an approve with no grant, to both faces', () => {
        const s = withGrant('ABSENT', { decision: decision('APPROVE') })
        expect(deriveState(s, 'publisher')).toBe('APPROVED_GRANT_MISSING')
        expect(deriveState(s, 'subscriber')).toBe('APPROVED_GRANT_MISSING')
      })

      it('does not collapse APPROVED_GRANT_MISSING into PENDING or APPROVED', () => {
        const state = deriveState(
          withGrant('ABSENT', { decision: decision('APPROVE') }),
          'subscriber',
        )
        expect(state).not.toBe('PENDING')
        expect(state).not.toBe('APPROVED')
      })

      it('is REJECTED_GRANT_PRESENT for a reject with a grant still present', () => {
        const s = withGrant('PRESENT', { decision: decision('REJECT') })
        expect(deriveState(s, 'publisher')).toBe('REJECTED_GRANT_PRESENT')
        expect(deriveState(s, 'subscriber')).toBe('REJECTED_GRANT_PRESENT')
      })

      it('is REVOKE_FAILED to the publisher for a revoke whose grant is still present', () => {
        const s = withGrant('PRESENT', { decision: decision('REVOKE') })
        expect(deriveState(s, 'publisher')).toBe('REVOKE_FAILED')
      })
    })
  })

  /**
   * `grantIsPresent` is the only sanctioned basis for offering a read
   * affordance, so its false cases matter more than its true ones: a Files tab
   * offered on a missing or unread grant mints and fails.
   */
  describe('grantIsPresent', () => {
    it('is true for APPROVED', () => {
      expect(grantIsPresent('APPROVED')).toBe(true)
    })

    it('is true for REVOKE_FAILED, because the grant demonstrably is present', () => {
      expect(grantIsPresent('REVOKE_FAILED')).toBe(true)
    })

    it('is false for APPROVED_GRANT_MISSING', () => {
      expect(grantIsPresent('APPROVED_GRANT_MISSING')).toBe(false)
    })

    it('is false for UNKNOWN, where the read-back did not answer', () => {
      expect(grantIsPresent('UNKNOWN')).toBe(false)
    })

    it.each<SubscriptionState>([
      'PENDING',
      'REJECTED',
      'REVOKED',
      'APPROVAL_FAILED',
      'REJECTED_GRANT_PRESENT',
    ])('is false for %s', (state) => {
      expect(grantIsPresent(state)).toBe(false)
    })
  })

  describe('isDisagreement', () => {
    it.each<SubscriptionState>([
      'APPROVAL_FAILED',
      'APPROVED_GRANT_MISSING',
      'REJECTED_GRANT_PRESENT',
      'REVOKE_FAILED',
      'UNKNOWN',
    ])('marks %s for attention', (state) => {
      expect(isDisagreement(state)).toBe(true)
    })

    it.each<SubscriptionState>(['PENDING', 'APPROVED', 'REJECTED', 'REVOKED'])(
      'leaves %s unmarked',
      (state) => {
        expect(isDisagreement(state)).toBe(false)
      },
    )
  })

  describe('mayHaveLiveGrant', () => {
    // Sharing gates Revoke on this. The tempting predicate is `isDisagreement`,
    // which is wrong in a way no type catches: two of the states it marks for
    // attention are states where the grant read back ABSENT, so offering Revoke
    // on them offers to remove a grant that was never written.
    it.each<SubscriptionState>([
      'APPROVED',
      'REVOKE_FAILED',
      'REJECTED_GRANT_PRESENT',
      'UNKNOWN',
    ])('is true for %s, where a grant may still be serving reads', (state) => {
      expect(mayHaveLiveGrant(state)).toBe(true)
    })

    it.each<SubscriptionState>(['APPROVAL_FAILED', 'APPROVED_GRANT_MISSING'])(
      'is false for %s: the read-back said ABSENT, so there is nothing to revoke',
      (state) => {
        expect(mayHaveLiveGrant(state)).toBe(false)
        // The trap, asserted so a future edit cannot quietly widen the gate back
        // to every state that wants the publisher's attention.
        expect(isDisagreement(state)).toBe(true)
      },
    )

    it.each<SubscriptionState>(['PENDING', 'REJECTED', 'REVOKED'])(
      'is false for %s',
      (state) => {
        expect(mayHaveLiveGrant(state)).toBe(false)
      },
    )
  })

  describe('stateCopy', () => {
    it('never renders UNKNOWN as a concrete state, and names what was last confirmed', () => {
      const copy = stateCopy(
        withGrant('UNREAD', { decision: decision('APPROVE') }),
        'subscriber',
      )
      expect(copy.label).toBe('State unknown')
      expect(copy.detail).toContain('Last confirmed: approved')
      expect(copy.detail).toContain('could not be read')
      expect(copy.attention).toBe(true)
    })

    it('says a revoke leaves credentials working until they expire', () => {
      const copy = stateCopy(
        withGrant('ABSENT', { decision: decision('REVOKE') }),
        'subscriber',
      )
      // The TTL is the revocation granularity. "Access removed" would assert a
      // security outcome that is not true yet.
      expect(copy.detail).toContain('keep working until they expire')
      expect(copy.detail).not.toMatch(/access removed/i)
    })

    it('reports an approval failure as still pending, with the cause verbatim', () => {
      const copy = stateCopy(withGrant('ABSENT', { lastFailure: failure }), 'publisher')
      expect(copy.label).toBe('Approval failed')
      expect(copy.detail).toContain(failure.cause)
      expect(copy.detail).toContain('still pending')
      expect(copy.attention).toBe(true)
    })

    it('shows the grant read-back time on an approval, not just the decision time', () => {
      // *Approved* means a grant read back at a time, not that somebody pressed a
      // button, so the evidence line carries the read-back.
      const copy = stateCopy(
        withGrant('PRESENT', { decision: decision('APPROVE') }),
        'subscriber',
      )
      expect(copy.detail).toContain('Grant confirmed')
    })

    it('gives the publisher’s reason verbatim on a rejection', () => {
      const copy = stateCopy(
        withGrant('ABSENT', {
          decision: decision('REJECT', 'ask again with a study id'),
        }),
        'subscriber',
      )
      expect(copy.detail).toContain('ask again with a study id')
    })

    it('marks a grant-missing approval for attention without resolving it', () => {
      const copy = stateCopy(
        withGrant('ABSENT', { decision: decision('APPROVE') }),
        'publisher',
      )
      expect(copy.label).toBe('Approved — grant missing')
      expect(copy.detail).toContain('could not be confirmed')
      expect(copy.attention).toBe(true)
    })
  })

  describe('holdingSummary', () => {
    it('says owner for an owner holding', () => {
      const copy = holdingSummary({ role: 'OWNER' })
      expect(copy?.label).toBe('Owner')
      expect(copy?.attention).toBe(false)
    })

    it('renders a subscriber holding as the relation plus its derived state', () => {
      const copy = holdingSummary({
        role: 'SUBSCRIBER',
        subscription: withGrant('PRESENT', { decision: decision('APPROVE') }),
      })
      expect(copy?.label).toBe('Subscribed · approved')
    })

    it('keeps a disagreement marked in the list, rather than resolving it', () => {
      const copy = holdingSummary({
        role: 'SUBSCRIBER',
        subscription: withGrant('UNREAD', { decision: decision('APPROVE') }),
      })
      expect(copy?.label).toBe('Subscribed · state unknown')
      expect(copy?.attention).toBe(true)
    })

    it('is null for a volume the workspace does not hold', () => {
      expect(holdingSummary(null)).toBeNull()
    })

    it('is null for an attached bucket, which has no subscription state to show', () => {
      expect(holdingSummary({ role: 'ATTACHED' })).toBeNull()
    })
  })
})
