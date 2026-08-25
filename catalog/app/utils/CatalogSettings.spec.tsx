import { act } from '@testing-library/react'
import { renderHook } from '@testing-library/react-hooks'
import { describe, it, expect, vi, beforeEach } from 'vitest'

import type * as Model from 'model'

vi.mock('constants/config', () => ({
  default: { serviceBucket: 'test-bucket', mode: 'PRODUCT' },
}))

const putObjectMock = vi.fn<
  (params: { Bucket: string; Key: string; ContentType?: string; Body: unknown }) => {
    promise: () => Promise<{ VersionId?: string }>
  }
>(() => ({ promise: () => Promise.resolve({}) }))

// Stands in for the object store. `getObject` reads from `stored`, `putObject`
// writes to it, so a test can interleave two writers against one document and
// assert on what actually survives -- which is the whole point: the bug is not
// visible in a single writer's own view.
let stored: string | null = null

const getObjectMock = vi.fn<
  (params: { Bucket: string; Key: string }) => {
    promise: () => Promise<{ Body: unknown }>
  }
>(() => ({
  promise: () =>
    stored === null
      ? Promise.reject(Object.assign(new Error('NoSuchKey'), { code: 'NoSuchKey' }))
      : Promise.resolve({ Body: Buffer.from(stored, 'utf-8') }),
}))

const s3Mock = { putObject: putObjectMock, getObject: getObjectMock }

vi.mock('utils/AWS', () => ({
  S3: { use: () => s3Mock },
}))

const patchOkMock = vi.fn()

vi.mock('utils/ResourceCache', () => ({
  createResource: () => ({}),
  use: () => ({ patchOk: patchOkMock }),
  useData: () => null,
}))

vi.mock('@sentry/react', () => ({ captureException: vi.fn() }))

import type { CatalogSettings } from './CatalogSettings'
import {
  SettingsConflictError,
  useUploadFile,
  useWriteSettings,
  UnsupportedLogoTypeError,
} from './CatalogSettings'

function makeFile(name: string, type = 'image/png', body = 'x') {
  const f = new File([body], name, { type })
  // TODO: remove custom polyfill after updating `jsdom` (https://github.com/jsdom/jsdom/pull/4050)
  if (!f.arrayBuffer) {
    ;(f as { arrayBuffer: () => Promise<ArrayBuffer> }).arrayBuffer = async () =>
      new TextEncoder().encode(body).buffer as ArrayBuffer
  }
  return f
}

// Writes land in `stored`, so a second writer's `getObject` sees the first
// writer's document. Without this the interleaving tests would be asserting
// against a store that never changes, and would pass either way.
function persistOnPut() {
  putObjectMock.mockImplementation(({ Body }) => {
    stored = String(Body)
    return { promise: () => Promise.resolve({}) }
  })
}

const parseStored = (): CatalogSettings | null =>
  stored === null ? null : (JSON.parse(stored) as CatalogSettings)

describe('utils/CatalogSettings', () => {
  // Two admins editing different fields of one settings document. Every write
  // replaces the whole document from the writer's own snapshot, so the second
  // writer carries a stale copy of the first writer's field.
  //
  // These are the regression tests for the lost-update bug: each asserts on what
  // survives in the store, not on what the losing writer believes.
  describe('useWriteSettings concurrency', () => {
    beforeEach(() => {
      stored = null
      putObjectMock.mockReset()
      getObjectMock.mockClear()
      patchOkMock.mockClear()
      persistOnPut()
    })

    it('refuses a write built from a stale snapshot instead of reverting the other admin', async () => {
      // Both tabs load the same document.
      const initial: CatalogSettings = { features: { 'front-door': false } }
      stored = JSON.stringify(initial, null, 2)
      const snapshotB = parseStored()

      const { result } = renderHook(() => useWriteSettings())

      // Tab A saves a theme change.
      await act(async () => {
        await result.current(
          { ...initial, theme: { palette: { primary: { main: '#282b50' } } } },
          initial,
        )
      })
      expect(parseStored()?.theme?.palette?.primary?.main).toBe('#282b50')

      // Tab B flips a preview switch, still holding the pre-A snapshot. Its
      // document would carry `theme: undefined` and erase A's change.
      let err: unknown
      await act(async () => {
        await result
          .current({ ...snapshotB, features: { 'front-door': true } }, snapshotB)
          .catch((e) => {
            err = e
          })
      })

      expect(err).toBeInstanceOf(SettingsConflictError)
      // A's theme survived, and B's flag was not written.
      expect(parseStored()?.theme?.palette?.primary?.main).toBe('#282b50')
      expect(parseStored()?.features?.['front-door']).toBe(false)
    })

    it('does not touch the store or the cache when it detects a conflict', async () => {
      stored = JSON.stringify({ beta: true }, null, 2)
      const stale: CatalogSettings = { beta: false }

      const { result } = renderHook(() => useWriteSettings())
      putObjectMock.mockClear()

      await act(async () => {
        await result
          .current({ ...stale, search: { mode: 'packages' } }, stale)
          .catch(() => {})
      })

      // The refusal must not leave the local cache claiming the write landed --
      // that is how a losing client stops finding out it lost.
      expect(putObjectMock).not.toHaveBeenCalled()
      expect(patchOkMock).not.toHaveBeenCalled()
      expect(parseStored()).toEqual({ beta: true })
    })

    // CONTROL: exercises the guard's permissive side, which unguarded code
    // satisfies trivially by never refusing. Pins that conflict detection does not
    // block the legitimate retry path; not evidence the race is fixed.
    it('CONTROL: lets the second admin through once they reload', async () => {
      stored = JSON.stringify(
        { theme: { palette: { primary: { main: '#282b50' } } } },
        null,
        2,
      )
      const { result } = renderHook(() => useWriteSettings())

      // Re-read after the conflict, then reapply: both changes coexist.
      const fresh = parseStored()
      await act(async () => {
        await result.current({ ...fresh, features: { 'front-door': true } }, fresh)
      })

      expect(parseStored()?.theme?.palette?.primary?.main).toBe('#282b50')
      expect(parseStored()?.features?.['front-door']).toBe(true)
    })

    it('treats a settings file appearing under it as a conflict', async () => {
      // The `null` snapshot is a real claim -- "there was no settings file when I
      // read" -- so a file created since then must not be overwritten.
      stored = JSON.stringify({ beta: true }, null, 2)

      const { result } = renderHook(() => useWriteSettings())
      let err: unknown
      await act(async () => {
        await result.current({ features: { 'front-door': true } }, null).catch((e) => {
          err = e
        })
      })

      expect(err).toBeInstanceOf(SettingsConflictError)
      expect(parseStored()).toEqual({ beta: true })
    })

    // CONTROL: permissive side again -- unguarded code writes here too. Pins that
    // a genuinely-absent settings file is not mistaken for a conflict, which would
    // brick the very first save on a fresh stack.
    it('CONTROL: writes on the first save when no settings file exists yet', async () => {
      stored = null
      const { result } = renderHook(() => useWriteSettings())

      await act(async () => {
        await result.current({ features: { 'front-door': true } }, null)
      })

      expect(parseStored()).toEqual({ features: { 'front-door': true } })
    })

    // CONTROL: also the permissive side, so unguarded code passes it too. Key
    // order is not content -- both sides come from `JSON.parse`, and a
    // reserialization that reorders keys is not another admin's edit. Guards
    // against the conflict check being too strict and refusing benign writes.
    it('CONTROL: does not report a conflict for a reordered but identical document', async () => {
      stored = '{\n  "beta": true,\n  "features": {\n    "front-door": true\n  }\n}'
      const reordered: CatalogSettings = {
        features: { 'front-door': true },
        beta: true,
      }

      const { result } = renderHook(() => useWriteSettings())
      await act(async () => {
        await result.current({ ...reordered, beta: false }, reordered)
      })

      expect(parseStored()?.beta).toBe(false)
    })

    // CONTROL, not evidence: an omitted `expected` means the caller made no claim
    // about prior state, so there is nothing to compare. This passes before and
    // after the fix by design -- it pins the opt-out, and would catch the guard
    // becoming mandatory and breaking callers that cannot supply a snapshot.
    it('CONTROL: skips the check entirely when no snapshot is supplied', async () => {
      stored = JSON.stringify({ beta: true }, null, 2)
      const { result } = renderHook(() => useWriteSettings())

      await act(async () => {
        await result.current({ features: { 'front-door': true } })
      })

      expect(getObjectMock).not.toHaveBeenCalled()
      expect(parseStored()).toEqual({ features: { 'front-door': true } })
    })
  })

  describe('useUploadFile', () => {
    it.each([
      ['image/png', 'catalog/logo.png'],
      ['image/jpeg', 'catalog/logo.jpg'],
      ['image/webp', 'catalog/logo.webp'],
      ['image/gif', 'catalog/logo.gif'],
    ])('derives key from MIME type %s -> %s', async (mime, expectedKey) => {
      putObjectMock.mockClear()
      putObjectMock.mockReturnValueOnce({
        promise: () => Promise.resolve({ VersionId: 'v1' }),
      })
      const { result } = renderHook(() => useUploadFile())
      let uploaded: Model.S3.S3ObjectLocation | undefined
      await act(async () => {
        uploaded = await result.current(makeFile('whatever.bin', mime))
      })
      expect(uploaded).toEqual({
        bucket: 'test-bucket',
        key: expectedKey,
        version: 'v1',
      })
      const arg = putObjectMock.mock.calls[0][0]
      expect(arg.Key).toBe(expectedKey)
      expect(arg.ContentType).toBe(mime)
      expect(arg.Body).toBeInstanceOf(Uint8Array)
    })

    it('rejects SVG (intentionally not on the IAM allowlist)', async () => {
      putObjectMock.mockClear()
      const { result } = renderHook(() => useUploadFile())
      await expect(
        result.current(makeFile('brand.svg', 'image/svg+xml')),
      ).rejects.toBeInstanceOf(UnsupportedLogoTypeError)
      expect(putObjectMock).not.toHaveBeenCalled()
    })

    it('rejects file with empty MIME type', async () => {
      putObjectMock.mockClear()
      const { result } = renderHook(() => useUploadFile())
      await expect(result.current(makeFile('logo', ''))).rejects.toBeInstanceOf(
        UnsupportedLogoTypeError,
      )
      expect(putObjectMock).not.toHaveBeenCalled()
    })

    it('ignores filename extension; uses MIME type', async () => {
      putObjectMock.mockClear()
      const { result } = renderHook(() => useUploadFile())
      await act(async () => {
        await result.current(makeFile('my.company.logo.gif', 'image/png'))
      })
      expect(putObjectMock.mock.calls[0][0].Key).toBe('catalog/logo.png')
    })
  })
})
