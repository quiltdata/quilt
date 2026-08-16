import { act } from '@testing-library/react'
import { renderHook } from '@testing-library/react-hooks'
import { describe, it, expect, vi, beforeEach } from 'vitest'

import type { CatalogSettings } from 'utils/CatalogSettings'

let settings: CatalogSettings | null = null
const writeSettings = vi.fn<
  (s: CatalogSettings, expected?: CatalogSettings | null) => Promise<void>
>(async () => {})

vi.mock('utils/CatalogSettings', () => ({
  use: () => settings,
  useWriteSettings: () => writeSettings,
}))

import type { FeatureId } from './features'
import { FEATURES, FEATURE_IDS, isEnabled, useFeatureSetting } from './features'

// These exercise the switching machinery, not any one capability, so they name
// ids the registry does not declare -- that keeps them from having to be
// rewritten every time a capability slice adds or retires an entry.
//
// The ids stay plain strings and the cast lives in `asId`, at the argument
// boundary only. Typing the constants themselves as `FeatureId` would collapse
// both to the same literal type, and TypeScript then reads
// `{ [OTHER]: true, [ID]: true }` as one key written twice.
const ID = 'demo-capability'
const OTHER = 'other-capability'
const asId = (id: string) => id as unknown as FeatureId

describe('utils/features', () => {
  beforeEach(() => {
    settings = null
    writeSettings.mockClear()
  })

  // The admin card renders straight off the registry and is hidden entirely
  // when it is empty, so these pin the two things a capability slice can break
  // without any read site noticing: that its entry is actually declared, and
  // that every declared entry has the copy the switch needs.
  describe('registry', () => {
    it('declares the front door', () => {
      expect(FEATURE_IDS).toContain('front-door')
    })

    it('gives every capability a label and a description', () => {
      FEATURE_IDS.forEach((id) => {
        expect(FEATURES[id].label).toBeTruthy()
        expect(FEATURES[id].description).toBeTruthy()
      })
    })
  })

  describe('isEnabled', () => {
    it('is off when settings are absent (LOCAL mode, no file, AccessDenied)', () => {
      expect(isEnabled(null, asId(ID))).toBe(false)
    })

    it('is off when no capability has ever been switched on', () => {
      expect(isEnabled({}, asId(ID))).toBe(false)
      expect(isEnabled({ features: {} }, asId(ID))).toBe(false)
    })

    it('is off for a different capability', () => {
      expect(isEnabled({ features: { [OTHER]: true } }, asId(ID))).toBe(false)
    })

    it('is on only for a literal `true`', () => {
      expect(isEnabled({ features: { [ID]: true } }, asId(ID))).toBe(true)
      expect(isEnabled({ features: { [ID]: false } }, asId(ID))).toBe(false)
    })

    // settings.json is hand-editable and `JSON.parse`d straight to a cast with
    // no schema, so a truthy value is not consent to open a preview gate.
    it.each([[1], ['true'], ['yes'], [{}], [[]]])(
      'is off for the truthy non-boolean %j',
      (value) => {
        const doc = { features: { [ID]: value } } as unknown as CatalogSettings
        expect(isEnabled(doc, asId(ID))).toBe(false)
      },
    )
  })

  describe('useFeatureSetting', () => {
    it('reports the stored value', () => {
      settings = { features: { [ID]: true } }
      const { result } = renderHook(() => useFeatureSetting(asId(ID)))
      expect(result.current[0]).toBe(true)
    })

    it('writes the flag when settings have never been saved', async () => {
      settings = null
      const { result } = renderHook(() => useFeatureSetting(asId(ID)))
      await act(async () => {
        await result.current[1](true)
      })
      // `null` is a real claim -- "there was no settings file when I read" -- not
      // an absent one, so it is passed rather than omitted.
      expect(writeSettings).toHaveBeenCalledWith({ features: { [ID]: true } }, null)
    })

    // `useWriteSettings` replaces the whole document, so anything this hook
    // fails to carry forward is silently destroyed the first time an admin
    // touches a switch.
    it('preserves the rest of the settings document', async () => {
      settings = {
        beta: true,
        customNavLink: { url: 'https://example.com', label: 'Docs' },
        logo: { url: 's3://bucket/catalog/logo.png' },
        search: { mode: 'packages' },
        theme: { palette: { primary: { main: '#282b50' } } },
      }
      const { result } = renderHook(() => useFeatureSetting(asId(ID)))
      await act(async () => {
        await result.current[1](true)
      })
      expect(writeSettings).toHaveBeenCalledWith(
        {
          ...settings,
          features: { [ID]: true },
        },
        settings,
      )
    })

    it('preserves sibling flags', async () => {
      settings = { features: { [OTHER]: true } }
      const { result } = renderHook(() => useFeatureSetting(asId(ID)))
      await act(async () => {
        await result.current[1](true)
      })
      expect(writeSettings).toHaveBeenCalledWith(
        {
          features: { [OTHER]: true, [ID]: true },
        },
        settings,
      )
    })

    it('writes `false` rather than deleting the key', async () => {
      settings = { features: { [ID]: true } }
      const { result } = renderHook(() => useFeatureSetting(asId(ID)))
      await act(async () => {
        await result.current[1](false)
      })
      expect(writeSettings).toHaveBeenCalledWith({ features: { [ID]: false } }, settings)
    })

    // The spread that carries the rest of the document forward is only correct
    // against a document that is still current, so the snapshot it spread has to
    // reach the write as `expected`. Without this argument the conflict check in
    // `useWriteSettings` has nothing to compare and silently does nothing -- the
    // switch would be back to reverting whatever another admin just saved.
    it('passes the snapshot it built the write from', async () => {
      settings = { theme: { palette: { primary: { main: '#282b50' } } } }
      const { result } = renderHook(() => useFeatureSetting(asId(ID)))
      await act(async () => {
        await result.current[1](true)
      })
      expect(writeSettings.mock.calls[0][1]).toBe(settings)
    })
  })
})
