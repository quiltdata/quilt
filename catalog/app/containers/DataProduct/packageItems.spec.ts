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

const PKG_MODIFIED = new Date('2020-01-01T00:00:00Z')

const mkMember = (
  hashOrTag: string | null,
  revision: MemberRevision | null = REV,
): PackageMember =>
  ({
    __typename: 'DataProductPackageMember',
    virtualName: 'virtual/name',
    bucket: 'phys-bucket',
    name: 'phys/pkg',
    hashOrTag,
    package: {
      __typename: 'Package',
      modified: PKG_MODIFIED,
      revisions: { __typename: 'PackageRevisionList', total: 3 },
      revision,
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
    package: null,
  }) as unknown as PackageMember

describe('containers/DataProduct/packageItems', () => {
  describe('effectiveRevision', () => {
    it('returns the latest revision for an unpinned member', () => {
      expect(effectiveRevision(mkMember(null))).toBe(REV)
    })

    it('returns the latest revision when the pin is the full latest hash', () => {
      expect(effectiveRevision(mkMember('abcdef1234567890'))).toBe(REV)
    })

    it('returns the latest revision when a >=6-char pin prefix-matches the hash', () => {
      expect(effectiveRevision(mkMember('abcdef'))).toBe(REV)
    })

    it('returns null for a <6-char pin even if it prefixes the hash', () => {
      expect(effectiveRevision(mkMember('abcde'))).toBeNull()
    })

    it('returns null when the pin does not match the latest hash', () => {
      expect(effectiveRevision(mkMember('999999'))).toBeNull()
    })

    it('returns null when no revision is in hand', () => {
      expect(effectiveRevision(mkMember('abcdef', null))).toBeNull()
      expect(effectiveRevision(mkMemberNoPackage())).toBeNull()
    })
  })

  describe('toPackageItem', () => {
    it('maps an unpinned member to a hit carrying the latest revision stats', () => {
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

    it('maps a pinned prefix-matching member to the revision stats', () => {
      const item = toPackageItem(mkMember('abcdef'))
      expect(item.hit!.pointer).toBe('abcdef')
      expect(item.hit!.hash).toBe('abcdef1234567890')
      expect(item.hit!.size).toBe(1024)
      expect(item.modified).toEqual(new Date('2021-06-01T00:00:00Z'))
    })

    it('renders unknown stats for a pinned non-matching member', () => {
      const item = toPackageItem(mkMember('999999'))
      expect(item.hit).toBeTruthy()
      // no matching revision in hand -> honest "unknown" cells
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
