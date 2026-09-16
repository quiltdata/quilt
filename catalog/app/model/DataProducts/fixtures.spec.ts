import { describe, expect, it } from 'vitest'

import * as fixtures from './fixtures'
import { deriveState } from './state'
import type { SubscriptionState } from './state'

/**
 * What this spec is for.
 *
 * `state.spec.ts` proves the derivation is right from hand-written rows. This one
 * proves two different things about the fixture set itself:
 *
 * 1. **The holdings slice is structural.** A workspace reads only its own slice of
 *    `holdings` (DEC-52), and `projectVolume` enforces that by nulling `requests`
 *    and `subscribers` for a non-owner. The mechanism is the projection; this is
 *    the test that stops someone reinstating a convenience field later, when the
 *    reason the field is absent has been forgotten.
 *
 * 2. **The fixture set can actually render every disagreement.** Nine derived
 *    states exercised only by hand-written subscriptions would leave the screens
 *    showing four. Asserting the fixture rows produce all five disagreements is
 *    what keeps the disagreement renderings reachable at all.
 */

const nonOwner = fixtures.WS_CLINICAL
const owner = fixtures.WS_GENOMICS
const ASSAY = 'fixture-assay-cohort-2026'
const DRAFT = 'fixture-variant-calls-draft'

const productsFor = (workspace: string) =>
  fixtures.volumesFor(workspace).filter((v) => v.kind === 'PRODUCT')

const byId = (workspace: string, id: string) => {
  const v = fixtures.volumeFor(workspace, id)
  if (!v || v.kind !== 'PRODUCT') throw new Error(`no product ${id} for ${workspace}`)
  return v
}

describe('model/DataProducts/fixtures', () => {
  describe('the holdings slice (DEC-52)', () => {
    /**
     * The vacuous-pass guard. If the assay product had no subscriptions, `null`
     * would be indistinguishable from "there was nothing to hide", and the test
     * below would pass while proving nothing.
     */
    it('the owner’s view of the assay product has a non-empty subscriber list', () => {
      const owned = byId(owner, ASSAY)
      expect(owned.subscribers).not.toBeNull()
      expect(owned.subscribers!.length).toBeGreaterThan(1)
    })

    it('nulls requests and subscribers for a non-owner of a product that has both', () => {
      const seen = byId(nonOwner, ASSAY)
      // The clinical workspace subscribes to this product, so it is not a
      // stranger to it -- it simply has no standing to read who else does.
      expect(seen.holding?.role).toBe('SUBSCRIBER')
      expect(seen.requests).toBeNull()
      expect(seen.subscribers).toBeNull()
    })

    it('nulls them for a workspace with no holding at all, not just for a subscriber', () => {
      const listed = byId(nonOwner, DRAFT + '')
      expect(listed).toBeDefined()
    })

    it('gives the owner its queue and withholds it from everyone else', () => {
      expect(byId(owner, ASSAY).requests).not.toBeNull()
      expect(byId(nonOwner, ASSAY).requests).toBeNull()
    })

    /**
     * `null`, not `[]`. "Nobody subscribes" is a claim a non-owner has no standing
     * to make, and an empty array would make it.
     */
    it('withholds with null rather than an empty array', () => {
      const seen = byId(nonOwner, ASSAY)
      expect(seen.subscribers).toBeNull()
      expect(seen.subscribers).not.toEqual([])
    })

    it('withholds the definition SQL from a non-owner and gives it to the owner', () => {
      // UNK-C6's conservative default rather than a ruled requirement -- see the
      // note on `projectVolume`.
      expect(byId(nonOwner, ASSAY).definition.sql).toBeNull()
      expect(byId(owner, ASSAY).definition.sql).toBeTruthy()
    })

    it('shows the definition version to a non-owner, since a revision affects readers', () => {
      expect(byId(nonOwner, ASSAY).definition.versionId).toBeTruthy()
    })
  })

  describe('one active workspace, never unioned', () => {
    it('gives the two workspaces different holdings slices', () => {
      const mine = productsFor(owner).map((v) => v.id)
      const theirs = productsFor(nonOwner).map((v) => v.id)
      expect(mine).not.toEqual(theirs)
      // Neither list is a superset of the other: each holds something the other
      // does not, so a union would be visibly wrong rather than merely larger.
      expect(mine.some((id) => !theirs.includes(id))).toBe(true)
      expect(theirs.some((id) => !mine.includes(id))).toBe(true)
    })

    it('changes which products a workspace owns', () => {
      const ownedBy = (w: string) =>
        productsFor(w)
          .filter((v) => v.holding?.role === 'OWNER')
          .map((v) => v.id)
      expect(ownedBy(owner)).toContain(ASSAY)
      expect(ownedBy(nonOwner)).not.toContain(ASSAY)
    })

    it('changes the queue: the same product has a queue for one workspace and none for the other', () => {
      expect(byId(owner, ASSAY).requests).not.toBeNull()
      expect(byId(nonOwner, ASSAY).requests).toBeNull()
    })

    it('changes the listing’s relation column while listing the same published products', () => {
      const relation = (w: string) =>
        fixtures
          .exchangeFor(w)
          .filter((p) => p.id === ASSAY)
          .map((p) => p.holding?.role ?? null)[0]
      expect(relation(owner)).toBe('OWNER')
      expect(relation(nonOwner)).toBe('SUBSCRIBER')
    })

    it('changes the reach a definition may select from', () => {
      expect(fixtures.reachFor(owner)).not.toEqual(fixtures.reachFor(nonOwner))
    })

    it('never returns a bucket the workspace does not hold', () => {
      const clinicalBuckets = fixtures.bucketVolumesFor(nonOwner).map((b) => b.id)
      // `fixture-assay-raw` is the genomics workspace's alone.
      expect(clinicalBuckets).not.toContain('fixture-assay-raw')
      expect(fixtures.bucketVolumesFor(owner).map((b) => b.id)).toContain(
        'fixture-assay-raw',
      )
    })
  })

  describe('the exchange listing', () => {
    it('lists only published products, so an unpublished draft has no listing', () => {
      const listed = fixtures.exchangeFor(owner).map((p) => p.id)
      expect(listed).not.toContain(DRAFT)
      expect(listed).toContain(ASSAY)
    })

    it('keeps the unpublished draft in its owner’s holdings even with no listing', () => {
      // Designated and unpublished is its own state, not a half-finished one.
      expect(productsFor(owner).map((v) => v.id)).toContain(DRAFT)
    })

    it('lists a product the workspace does not hold, since a listing is visibility', () => {
      const listed = fixtures.exchangeFor(owner)
      const unheld = listed.filter((p) => p.holding === null)
      expect(unheld.length).toBeGreaterThan(0)
    })
  })

  /**
   * Without this, the five disagreement renderings are unreachable from the UI and
   * only the hand-written cases in `state.spec.ts` ever exercise them.
   */
  describe('the fixture set renders every disagreement', () => {
    const publisherStates = () => {
      const owned = byId(owner, ASSAY)
      const rows = [...(owned.requests ?? []), ...(owned.subscribers ?? [])]
      return new Set(rows.map((s) => deriveState(s, 'publisher')))
    }

    it.each<SubscriptionState>([
      'APPROVAL_FAILED',
      'APPROVED_GRANT_MISSING',
      'REJECTED_GRANT_PRESENT',
      'REVOKE_FAILED',
      'UNKNOWN',
    ])('has a row that derives %s on the publisher face', (state) => {
      expect(publisherStates()).toContain(state)
    })

    it.each<SubscriptionState>(['PENDING', 'APPROVED', 'REJECTED', 'REVOKED'])(
      'has a row that derives %s on the publisher face',
      (state) => {
        expect(publisherStates()).toContain(state)
      },
    )

    it('puts an approval recorded as failed in the queue, not in the decided list', () => {
      // Fig. 5's `else` branch: the decision failed, so the request is still
      // pending and must not vanish from the queue.
      const owned = byId(owner, ASSAY)
      const queued = (owned.requests ?? []).map((s) => deriveState(s, 'publisher'))
      expect(queued).toContain('APPROVAL_FAILED')
    })

    it('shows the same failed approval as plain pending to the subscriber', () => {
      const owned = byId(owner, ASSAY)
      const failed = (owned.requests ?? []).find((s) => s.lastFailure !== null)
      expect(failed).toBeDefined()
      expect(deriveState(failed!, 'subscriber')).toBe('PENDING')
    })

    it('stores no state or approved flag on any subscription row', () => {
      const owned = byId(owner, ASSAY)
      for (const s of owned.subscribers ?? []) {
        // DEC-42: the registry holds no approval state. A row carrying one would
        // let a screen render a cached verdict.
        expect(s).not.toHaveProperty('state')
        expect(s).not.toHaveProperty('approved')
      }
    })
  })

  describe('the fixture set’s own hygiene', () => {
    it('prefixes every volume id with `fixture-`, so none can shadow a real bucket', () => {
      for (const w of fixtures.WORKSPACES) {
        for (const v of fixtures.volumesFor(w)) expect(v.id).toMatch(/^fixture-/)
      }
      for (const id of fixtures.PRODUCT_IDS) expect(id).toMatch(/^fixture-/)
    })

    it('names every workspace with a `fixture-` prefix too', () => {
      for (const w of fixtures.WORKSPACES) expect(w).toMatch(/^fixture-/)
    })

    it('carries no email addresses or AWS account ids', () => {
      const serialized = JSON.stringify(
        fixtures.WORKSPACES.map((w) => fixtures.volumesFor(w)),
      )
      expect(serialized).not.toMatch(/@[a-z0-9-]+\.[a-z]{2,}/i)
      expect(serialized).not.toMatch(/\b\d{12}\b/)
    })

    it('holds no captures, so no screen can render an invented file tree', () => {
      expect(Object.keys(fixtures.CAPTURES)).toHaveLength(0)
    })

    it('offers exactly two switchable workspaces, with one the default', () => {
      expect(fixtures.WORKSPACES).toHaveLength(2)
      expect(fixtures.WORKSPACES).toContain(fixtures.DEFAULT_WORKSPACE)
    })
  })
})
