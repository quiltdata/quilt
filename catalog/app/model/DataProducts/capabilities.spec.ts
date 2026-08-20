import { describe, it, expect } from 'vitest'

import * as DP from './index'
import * as fixtures from './fixtures'

describe('model/DataProducts/capabilities', () => {
  describe('forMode', () => {
    it('intersection mode ignores platform extras', () => {
      // Unity has the strongest capability set; intersection must not leak it.
      const unity = DP.forMode('unity-schema', 'capability-aware')
      const flattened = DP.forMode('unity-schema', 'intersection')

      expect(unity.effectivePermissions).toBe(true)
      expect(unity.curationStatus).toBe(true)
      expect(flattened.effectivePermissions).toBe(false)
      expect(flattened.curationStatus).toBe(false)
      expect(flattened).toEqual(DP.INTERSECTION)
    })

    it('intersection mode is identical across platforms', () => {
      const kinds = [
        'datazone',
        'unity-schema',
        'unity-share',
        'snowflake-listing',
      ] as const
      const all = kinds.map((k) => DP.forMode(k, 'intersection'))
      all.forEach((caps) => expect(caps).toEqual(all[0]))
    })

    it('capability-aware mode distinguishes platforms', () => {
      const dz = DP.forMode('datazone', 'capability-aware')
      const uc = DP.forMode('unity-schema', 'capability-aware')

      // The two platforms are strong in opposite places -- that asymmetry is
      // the whole reason capability-aware mode exists.
      expect(dz.nativeProductEntity).toBe(true)
      expect(uc.nativeProductEntity).toBe(false)
      expect(dz.effectivePermissions).toBe(false)
      expect(uc.effectivePermissions).toBe(true)
    })

    it('treats both unity bindings as one platform', () => {
      expect(DP.forMode('unity-share', 'capability-aware')).toEqual(
        DP.forMode('unity-schema', 'capability-aware'),
      )
    })
  })

  describe('effectiveAccessForNamedUser', () => {
    it('is false on every platform, in both modes', () => {
      // Not a gap to be filled later: per-user visibility can depend on a row
      // policy calling an external function, so it is unknowable in principle.
      // If this test ever fails, someone has claimed something no platform can
      // support -- see contract clause 5.3/5.3a before "fixing" it.
      const kinds = [
        'datazone',
        'unity-schema',
        'unity-share',
        'snowflake-listing',
      ] as const
      kinds.forEach((k) => {
        expect(DP.forMode(k, 'capability-aware').effectiveAccessForNamedUser).toBe(false)
        expect(DP.forMode(k, 'intersection').effectiveAccessForNamedUser).toBe(false)
      })
    })
  })

  describe('mayBranchOn (clause 7.2 lock-in guard)', () => {
    it('permits branching when two or more platforms support it', () => {
      // initiableRequests: DataZone + Unity.
      expect(DP.supportingPlatformCount('initiableRequests')).toBeGreaterThanOrEqual(2)
      expect(DP.mayBranchOn('initiableRequests')).toBe(true)
    })

    it('refuses single-platform capabilities unless excepted', () => {
      // effectivePermissions is Unity-only and NOT excepted, so the UI must not
      // branch on it -- it would be portable-looking lock-in.
      expect(DP.supportingPlatformCount('effectivePermissions')).toBe(1)
      expect(DP.mayBranchOn('effectivePermissions')).toBe(false)
    })

    it('permits the documented curationStatus exception', () => {
      // Unity-only, but it is the sole curation primitive anywhere, so it earns
      // its branch by explicit exception rather than by count.
      expect(DP.supportingPlatformCount('curationStatus')).toBe(1)
      expect(DP.mayBranchOn('curationStatus')).toBe(true)
    })

    it('counts Unity once, not twice for its two bindings', () => {
      // A naive Object.values() count would report 2 here and wrongly clear the
      // clause-7.2 guard for every Unity-only capability.
      expect(DP.supportingPlatformCount('effectivePermissions')).toBe(1)
    })
  })
})

describe('model/DataProducts/fixtures', () => {
  it('every fixture carries capabilities matching its binding', () => {
    fixtures.ALL_PRODUCTS.forEach((p) => {
      expect(fixtures.capabilitiesFor(p)).toEqual(DP.CAPABILITIES[p.binding.kind])
    })
  })

  it('FILESET members never carry a schema', () => {
    // Volumes are not tables: no columns, and no row/column policy is possible.
    fixtures.ALL_PRODUCTS.flatMap((p) => p.members)
      .filter((m) => m.kind === 'FILESET')
      .forEach((m) => expect(m.schema).toBeNull())
  })

  it('declares no schema where the platform cannot supply one uniformly', () => {
    // DataZone tabular columns exist only inside an opaque JSON forms string,
    // so the capability is false even though the fixture shows columns.
    expect(DP.CAPABILITIES.datazone.memberSchema).toBe(false)
    expect(DP.CAPABILITIES['snowflake-listing'].memberSchema).toBe(false)
  })

  it('models discovery-only access as visible-but-unreadable', () => {
    const p = fixtures.DISCOVERY_ONLY_PRODUCT
    expect(p.members).toHaveLength(0)
    expect(fixtures.readableMembers(p)).toHaveLength(0)
    // Not an error and not an empty product: BROWSE is the grant that makes a
    // request-access affordance meaningful.
    expect(p.grants.some((g) => g.privilege === 'BROWSE')).toBe(true)
    expect(p.description).not.toBeNull()
  })

  it('uses NOT_VISIBLE rather than absence for unreadable policies', () => {
    // POLICY_REFERENCES is privilege-filtered, so "no policy visible to us" is
    // not "no policy exists". Rendering absence as a guarantee would be a false
    // assurance about data protection.
    expect(fixtures.SNOWFLAKE_PRODUCT.policyFlags.rowLevel).toBe('NOT_VISIBLE')
  })

  it('keeps native privilege strings alongside normalized ones', () => {
    // Unity needs USE CATALOG + USE SCHEMA + SELECT for one read; flattening to
    // READ would erase why a user can or cannot read.
    const natives = fixtures.UNITY_PRODUCT.grants.map((g) => g.nativePrivilege)
    expect(natives).toContain('USE CATALOG')
    expect(natives).toContain('USE SCHEMA')
    expect(natives).toContain('SELECT')
    fixtures.ALL_PRODUCTS.flatMap((p) => p.grants).forEach((g) => {
      expect(g.nativePrivilege.length).toBeGreaterThan(0)
    })
  })

  it('reports origin only where the platform can resolve inheritance', () => {
    // Unity's effective-permissions endpoint resolves it; DataZone
    // subscriptions and Snowflake role closures do not.
    expect(fixtures.UNITY_PRODUCT.grants.some((g) => g.origin === 'INHERITED')).toBe(true)
    fixtures.DATAZONE_PRODUCT.grants.forEach((g) => expect(g.origin).toBe('UNKNOWN'))
    fixtures.SNOWFLAKE_PRODUCT.grants.forEach((g) => expect(g.origin).toBe('UNKNOWN'))
  })

  it('populates curationStatus only on Unity', () => {
    expect(fixtures.UNITY_PRODUCT.curationStatus).toBe('certified')
    expect(fixtures.DATAZONE_PRODUCT.curationStatus).toBeNull()
    expect(fixtures.SNOWFLAKE_PRODUCT.curationStatus).toBeNull()
  })

  it('never models an owning entity as a bare person', () => {
    // DataZone has no per-product owner API at all; a human name would have to
    // be derived from project memberships.
    expect(fixtures.DATAZONE_PRODUCT.owningEntity?.kind).toBe('PROJECT')
  })

  it('states a contents source for every member (browse-into)', () => {
    // Operator decision 2026-08-17: Quilt browses INTO a product, so every
    // member must declare where its contents come from. Not defaulted on
    // purpose -- guessing means either hiding real contents or implying
    // governance that is not there.
    //
    // The list is spelled out rather than derived from the type because a type
    // cannot be enumerated at runtime, and that is the point: adding a source
    // breaks this test, which forces a decision about whether the new source
    // belongs in fixtures at all. It broke once already, for `PACKAGE`.
    const SOURCES = ['CATALOG', 'DIRECT_S3', 'PACKAGE', 'UNAVAILABLE']
    fixtures.ALL_PRODUCTS.flatMap((p) => p.members).forEach((m) => {
      expect(SOURCES).toContain(m.contentsSource)
    })
  })

  it('states a reason whenever contents are unavailable', () => {
    // `UNAVAILABLE` with no reason is renderable -- `reasonFor` falls back to
    // EMPTY -- but it is never what a fixture *means*, and the fallback exists
    // for adapters we do not control rather than for our own data. A fixture
    // that omits the reason silently claims "no files" about something
    // restricted or broken.
    fixtures.ALL_PRODUCTS.flatMap((p) => p.members)
      .filter((m) => m.contentsSource === 'UNAVAILABLE')
      .forEach((m) => {
        expect(m.unavailableReason).toBeDefined()
      })
  })

  it('pins every package-backed member to an immutable revision', () => {
    // The reproducibility guarantee, asserted rather than assumed. The broker
    // accepts an unpinned reference and silently resolves it to latest, so a
    // fixture without a topHash would model a moving target as a fixed one.
    // 64 hex chars: a real Quilt top hash, not a placeholder like "latest".
    fixtures.ALL_PRODUCTS.flatMap((p) => p.members)
      .filter((m) => m.contentsSource === 'PACKAGE')
      .forEach((m) => {
        expect(m.packageHandle?.topHash).toMatch(/^[0-9a-f]{64}$/)
        expect(m.packageHandle?.registry).toBeTruthy()
      })
  })

  it('reads DataZone file contents around the catalog, not through it', () => {
    // A DataZone S3 asset carries only {"bucketArn": ...} -- no file list, no
    // sizes, no per-object granularity. So showing file contents means Quilt
    // listing S3 directly, and the catalog's row/column governance does NOT
    // cover what we render. Contract §7.1 requires that asymmetry stay visible.
    const dzFilesets = fixtures.DATAZONE_PRODUCT.members.filter(
      (m) => m.kind === 'FILESET',
    )
    expect(dzFilesets.length).toBeGreaterThan(0)
    dzFilesets.forEach((m) => expect(m.contentsSource).toBe('DIRECT_S3'))

    // Tabular members on the same product are the governed case -- the two
    // sources must not be conflated into one undifferentiated list.
    fixtures.DATAZONE_PRODUCT.members
      .filter((m) => m.kind === 'TABLE' || m.kind === 'VIEW')
      .forEach((m) => expect(m.contentsSource).toBe('CATALOG'))
  })
})
