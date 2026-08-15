import { describe, expect, it } from 'vitest'

import { effectiveRevision, toPackageItem } from './packageItems'
import type { MemberRevision, PackageMember } from './packageItems'

const REV: MemberRevision = {
  __typename: 'PackageRevision',
  hash: 'abcdef1234567890',
  modified: new Date('2021-06-01T00:00:00Z'),
  message: 'a message',
  totalEntries: 5,
  totalBytes: 1024,
  userMeta: { study: { phase: 'III' } },
  workflow: { __typename: 'PackageWorkflow', id: 'wf-1' },
}

// A different revision, to show that a pinned member reports the revision it was
// pinned to and not whatever is latest.
const PINNED_REV: MemberRevision = {
  ...REV,
  hash: '999999aaaabbbbcc',
  modified: new Date('2019-03-01T00:00:00Z'),
  message: 'the pinned message',
  totalEntries: 2,
  totalBytes: 64,
}

const PKG_MODIFIED = new Date('2020-01-01T00:00:00Z')

const mkMember = (
  hashOrTag: string | null,
  resolvedRevision: MemberRevision | null = REV,
): PackageMember =>
  ({
    __typename: 'DataProductPackageMember',
    virtualName: 'virtual/name',
    bucket: 'phys-bucket',
    name: 'phys/pkg',
    hashOrTag,
    resolvedRevision,
    package: {
      __typename: 'Package',
      modified: PKG_MODIFIED,
      revisions: { __typename: 'PackageRevisionList', total: 3 },
    },
  }) as unknown as PackageMember

// A member whose package didn't dereference at all (not readable / gone).
const mkMemberNoPackage = (): PackageMember =>
  ({
    __typename: 'DataProductPackageMember',
    virtualName: 'virtual/name',
    bucket: 'phys-bucket',
    name: 'phys/pkg',
    hashOrTag: 'abcdef',
    resolvedRevision: null,
    package: null,
  }) as unknown as PackageMember

describe('containers/DataProduct/packageItems', () => {
  describe('effectiveRevision', () => {
    it('is whatever revision the registry resolved the member at', () => {
      expect(effectiveRevision(mkMember(null))).toBe(REV)
      expect(effectiveRevision(mkMember('999999aaaabbbbcc', PINNED_REV))).toBe(PINNED_REV)
    })

    it('is null when the member resolved to no revision', () => {
      expect(effectiveRevision(mkMember('abcdef', null))).toBeNull()
      expect(effectiveRevision(mkMemberNoPackage())).toBeNull()
    })
  })

  describe('toPackageItem', () => {
    it('maps an unpinned member to a hit carrying its resolved revision stats', () => {
      const item = toPackageItem(mkMember(null))
      expect(item.hit).toBeTruthy()
      expect(item.hit!.pointer).toBe('latest')
      expect(item.hit!.hash).toBe('abcdef1234567890')
      expect(item.hit!.size).toBe(1024)
      expect(item.hit!.totalEntriesCount).toBe(5)
      expect(item.hit!.comment).toBe('a message')
      expect(item.hit!.workflow).toEqual({ id: 'wf-1' })
      // the card leaf wants meta as a JSON string; the table hit wants the object
      expect(item.hit!.meta).toBe(JSON.stringify({ study: { phase: 'III' } }))
      expect(item.tableHit!.meta).toEqual({ study: { phase: 'III' } })
      // modified comes from the revision, not the package
      expect(item.modified).toEqual(new Date('2021-06-01T00:00:00Z'))
    })

    // The point of resolving pins server-side. The client used to only have the
    // latest revision, so a member pinned to anything else showed blank stats;
    // now the pinned revision's own numbers are in hand.
    it('shows a pinned member the revision it is pinned to, not the latest', () => {
      const item = toPackageItem(mkMember('999999aaaabbbbcc', PINNED_REV))
      expect(item.hit!.pointer).toBe('999999aaaabbbbcc')
      expect(item.hit!.hash).toBe('999999aaaabbbbcc')
      expect(item.hit!.size).toBe(64)
      expect(item.hit!.totalEntriesCount).toBe(2)
      expect(item.hit!.comment).toBe('the pinned message')
      expect(item.modified).toEqual(new Date('2019-03-01T00:00:00Z'))
    })

    it('renders unknown stats when the member resolved to no revision', () => {
      const item = toPackageItem(mkMember('999999', null))
      expect(item.hit).toBeTruthy()
      // no revision in hand -> honest "unknown" cells
      expect(item.hit!.size).toBeNull()
      expect(item.hit!.totalEntriesCount).toBeNull()
      expect(item.hit!.comment).toBeNull()
      expect(item.hit!.meta).toBeNull()
      // the pin is surfaced as-is; the hash falls back to the pin
      expect(item.hit!.pointer).toBe('999999')
      expect(item.hit!.hash).toBe('999999')
      // modified falls back to the package-level date
      expect(item.modified).toEqual(PKG_MODIFIED)
      expect(item.tableHit!.meta).toBeNull()
    })

    it('falls back to a null hit/tableHit for an undereferenced member', () => {
      const item = toPackageItem(mkMemberNoPackage())
      expect(item.hit).toBeNull()
      expect(item.tableHit).toBeNull()
      expect(item.modified).toBeNull()
    })
  })
})
