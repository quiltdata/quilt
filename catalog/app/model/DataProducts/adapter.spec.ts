import { describe, expect, it } from 'vitest'

import { supportsRequests } from './adapter'
import type { DataProductAdapter, RequestingAdapter } from './adapter'
import { fixtureAdapter } from './fixtureAdapter'
import * as fixtures from './fixtures'

/**
 * The port's contract, tested at the port.
 *
 * The container specs stub these hooks out (a suspending read would make every
 * assertion await a microtask), so this file is where the async shape is
 * actually exercised. Without it the stubbing in those specs would mean nobody
 * checks the thing they stub.
 */
describe('model/DataProducts/adapter', () => {
  describe('the port is async', () => {
    it('returns promises, not values', () => {
      // Load-bearing rather than pedantic: a real adapter is a network call, and
      // a caller that accidentally depends on synchronous resolution breaks the
      // day one lands. Asserting the shape here keeps the fixture adapter from
      // quietly licensing that mistake.
      expect(fixtureAdapter.listProducts()).toBeInstanceOf(Promise)
      expect(fixtureAdapter.getProduct('anything')).toBeInstanceOf(Promise)
      expect(fixtureAdapter.listRequests('anything')).toBeInstanceOf(Promise)
    })
  })

  describe('listProducts', () => {
    it('includes products the user cannot read into', async () => {
      // Discovery and readability are different questions. Filtering unreadable
      // products out here would hide the very case the request affordance exists
      // for.
      const products = await fixtureAdapter.listProducts()
      const ids = products.map((p) => p.id)
      expect(ids).toContain(fixtures.DISCOVERY_ONLY_PRODUCT.id)
      expect(fixtures.DISCOVERY_ONLY_PRODUCT.members).toHaveLength(0)
    })

    it('covers all four platform bindings', async () => {
      // A binding with no product is a rendering path nobody has looked at.
      const products = await fixtureAdapter.listProducts()
      const kinds = new Set(products.map((p) => p.binding.kind))
      expect(kinds).toEqual(
        new Set(['datazone', 'unity-schema', 'unity-share', 'snowflake-listing']),
      )
    })
  })

  describe('getProduct', () => {
    it('resolves a known id', async () => {
      const p = await fixtureAdapter.getProduct(fixtures.DATAZONE_PRODUCT.id)
      expect(p?.name).toBe('Clinical Cohort 2024')
    })

    it('resolves null for a miss, never undefined', async () => {
      // `null` is the promised answer and callers branch on it as data: a
      // synthesized id is not stable across renames (a Unity schema rename
      // changes it and emits no event), so a miss is ordinary drift rather than
      // an error. `undefined` leaking through would make `=== null` checks fail
      // silently.
      const p = await fixtureAdapter.getProduct('uc:aws-prod-metastore/quilt_demo/gone')
      expect(p).toBeNull()
      expect(p).not.toBeUndefined()
    })
  })

  describe('listRequests', () => {
    it('returns only the requests filed against that product', async () => {
      const dz = await fixtureAdapter.listRequests(fixtures.DATAZONE_PRODUCT.id)
      expect(dz).toHaveLength(2)
      expect(dz.every((r) => r.dataProductId === fixtures.DATAZONE_PRODUCT.id)).toBe(true)
    })

    it('answers for a product with no requests', async () => {
      // Always answerable, because the record is Quilt's -- an empty list is a
      // real answer, not a failure to reach the platform.
      expect(await fixtureAdapter.listRequests(fixtures.SNOWFLAKE_PRODUCT.id)).toEqual([])
    })
  })

  describe('supportsRequests', () => {
    it('is false for the fixture adapter', () => {
      // This is what keeps the submit affordance honestly disabled. A fixture
      // cannot file a request with a catalog, and implementing `submitRequest`
      // here would make the button look live while doing nothing -- a structural
      // lie rather than a visible one.
      expect(supportsRequests(fixtureAdapter)).toBe(false)
    })

    it('is true for an adapter that can actually file one', () => {
      // Guards the type predicate itself: if `supportsRequests` were written to
      // always return false, the test above would pass and the UI could never
      // enable submission even once a real adapter landed.
      const requesting: RequestingAdapter = {
        ...fixtureAdapter,
        submitRequest: async ({ dataProductId, beneficiary, reason }) => ({
          id: 'dpr_test',
          dataProductId,
          requestedBy: 'tester@quiltdata.io',
          beneficiary,
          reason,
          createdAt: new Date('2026-08-18T00:00:00.000Z'),
          // SUBMITTED at best: no adapter can approve on the catalog's behalf.
          status: 'SUBMITTED',
          platformRecord: null,
          retainedPermissions: null,
        }),
      }
      expect(supportsRequests(requesting)).toBe(true)
    })

    it('narrows the type so callers need no cast', async () => {
      const adapter: DataProductAdapter = fixtureAdapter
      if (supportsRequests(adapter)) {
        // Unreachable for the fixture adapter; present so the predicate's
        // narrowing is compiled, not merely asserted at runtime.
        const r = await adapter.submitRequest({
          dataProductId: 'x',
          beneficiary: { type: 'USER', label: 'a@b.c' },
          reason: 'y',
        })
        expect(r.status).toBe('SUBMITTED')
      }
      expect(supportsRequests(adapter)).toBe(false)
    })
  })
})
