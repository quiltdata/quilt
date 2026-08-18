import { describe, expect, it } from 'vitest'

import * as fixtures from './fixtures'
import { mayBranchOn } from './capabilities'
import {
  accessMayPersistAfterRevoke,
  grantsBeyondRequester,
  isSettled,
  type AccessRequest,
} from './requests'

describe('model/DataProducts/requests', () => {
  describe('why Quilt owns the record', () => {
    it('forbids branching the UI on whether the platform can list requests', () => {
      // The structural reason the request record is Quilt's. Only DataZone can
      // enumerate pending requests, so a queue built by branching on the
      // platform would exist on one platform and silently not exist on the
      // other two. Initiating is a different story -- two platforms support it,
      // so a request affordance may branch.
      expect(mayBranchOn('enumerableRequests')).toBe(false)
      expect(mayBranchOn('initiableRequests')).toBe(true)
    })
  })

  describe('revocation that did not revoke', () => {
    it('treats retained permissions as access that may still be in force', () => {
      // DataZone's revoke takes `retainPermissions`; when true the underlying
      // Lake Formation grants stay live while DataZone stops managing them.
      // Rendering this as a clean "revoked" asserts a security outcome that did
      // not happen.
      const r = fixtures.DATAZONE_REVOKED_RETAINED_REQUEST
      expect(r.status).toBe('REVOKED')
      expect(accessMayPersistAfterRevoke(r)).toBe(true)
      expect(isSettled(r)).toBe(false)
    })

    it('treats an unconfirmable revoke as unresolved, not as clean', () => {
      // null is "we could not determine", which must read as possibly-granted.
      // Defaulting the unknown case to settled would be the same false
      // assurance, arrived at by omission.
      const unconfirmed: AccessRequest = {
        ...fixtures.DATAZONE_REVOKED_RETAINED_REQUEST,
        retainedPermissions: null,
      }
      expect(accessMayPersistAfterRevoke(unconfirmed)).toBe(true)
      expect(isSettled(unconfirmed)).toBe(false)
    })

    it('settles only a revoke confirmed to have taken effect', () => {
      const clean: AccessRequest = {
        ...fixtures.DATAZONE_REVOKED_RETAINED_REQUEST,
        retainedPermissions: false,
      }
      expect(accessMayPersistAfterRevoke(clean)).toBe(false)
      expect(isSettled(clean)).toBe(true)
    })
  })

  describe('unanswerable request state', () => {
    it('does not treat an unlistable Unity request as still syncing', () => {
      // Unity can initiate but not enumerate, so "no platform record" is the
      // steady state here, not a transient one. A UI reading this as in-flight
      // would spin forever.
      const r = fixtures.UNITY_SUBMITTED_REQUEST
      expect(r.platformRecord).toBeNull()
      expect(isSettled(r)).toBe(false)
    })

    it('does not treat UNKNOWN as a conclusion', () => {
      const unknown: AccessRequest = {
        ...fixtures.UNITY_SUBMITTED_REQUEST,
        status: 'UNKNOWN',
      }
      expect(isSettled(unknown)).toBe(false)
    })
  })

  describe('blast radius of an approval', () => {
    it('flags that approving a DataZone request grants a whole project', () => {
      // A subscription is held by a project, so one person asking means every
      // project member receives access. Showing only the requester would
      // misreport what approval does.
      const r = fixtures.DATAZONE_PENDING_REQUEST
      expect(r.requestedBy).toBe('rita@quiltdata.io')
      expect(r.beneficiary.type).toBe('PROJECT')
      expect(grantsBeyondRequester(r)).toBe(true)
    })

    it('does not flag a request that grants only the requester', () => {
      expect(grantsBeyondRequester(fixtures.UNITY_SUBMITTED_REQUEST)).toBe(false)
    })
  })

  describe('no time-bounded access', () => {
    it('carries no expiry field, because no platform can enforce one', () => {
      // An "access until Friday" control would read as a security boundary
      // while being decoration. Absence is the design, so assert it.
      const r = fixtures.DATAZONE_PENDING_REQUEST as AccessRequest &
        Record<string, unknown>
      expect(r.expiresAt).toBeUndefined()
    })
  })

  describe('fixtures', () => {
    it('indexes requests by product', () => {
      const dz = fixtures.requestsFor(fixtures.DATAZONE_PRODUCT)
      expect(dz).toHaveLength(2)
      expect(fixtures.requestsFor(fixtures.SNOWFLAKE_PRODUCT)).toHaveLength(0)
    })
  })
})
