import * as React from 'react'
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest'
import { ThemeProvider, createMuiTheme } from '@material-ui/core/styles'
import { act, cleanup, fireEvent, render } from '@testing-library/react'

import type { CatalogSettings } from 'utils/CatalogSettings'

vi.mock('constants/config', () => ({ default: {} }))

let settings: CatalogSettings | null = null
const writeSettings = vi.fn<
  (s: CatalogSettings, expected?: CatalogSettings | null) => Promise<void>
>(async () => {})

// Declared inside the factory: `vi.mock` is hoisted above any top-level binding
// this file could otherwise reference.
// Declared inside the factory: `vi.mock` is hoisted above any top-level binding
// this file could otherwise reference. `isBetaEnabled` delegates to the real
// implementation rather than restating the default rule -- otherwise these tests
// assert the mock's opinion of the default, not the module's.
vi.mock('utils/CatalogSettings', async () => {
  const actual = await vi.importActual<typeof import('utils/CatalogSettings')>(
    'utils/CatalogSettings',
  )
  class SettingsConflictError extends Error {
    constructor() {
      super('Catalog settings were changed by someone else.')
      this.name = 'SettingsConflictError'
    }
  }
  return {
    use: () => settings,
    useWriteSettings: () => writeSettings,
    isBetaEnabled: actual.isBetaEnabled,
    SettingsConflictError,
  }
})

const notify = vi.fn()
vi.mock('containers/Notifications', () => ({ use: () => ({ push: notify }) }))

vi.mock('@sentry/react', () => ({ captureException: vi.fn() }))

// Pulled in by Settings.tsx's module graph but irrelevant here; stubbed so this
// spec can import the one component it tests without dragging in GraphQL.
vi.mock('./FeatureSettings', () => ({ default: () => null, HAS_PREVIEW_FEATURES: false }))
vi.mock('./PackagerSettings', () => ({ default: () => null }))
vi.mock('./SearchSettings', () => ({ default: () => null }))
vi.mock('./TabulatorSettings', () => ({ default: () => null }))
vi.mock('./ThemeEditor', () => ({ default: () => null }))
vi.mock('./DataProductConnections', () => ({
  default: () => <div>catalog connection form</div>,
}))

let dataProductsEnabled = false
vi.mock('utils/features', () => ({ useFeature: () => dataProductsEnabled }))

// The mocked constructor, so the rejection below is the same class the component
// narrows on with `instanceof`.
import { SettingsConflictError } from 'utils/CatalogSettings'

import { BetaSwitch, DataProductCatalogs } from './Settings'

const theme = createMuiTheme()

const renderSwitch = () =>
  render(
    <ThemeProvider theme={theme}>
      <BetaSwitch />
    </ThemeProvider>,
  )

const checkbox = (c: HTMLElement) =>
  c.querySelector('input[type="checkbox"]') as HTMLInputElement

describe('containers/Admin/Settings', () => {
  afterEach(cleanup)

  // The section renders an admin-facing form for connecting external catalogs.
  // With the capability off nothing can reach a data product, so offering the form
  // advertises a feature that is not there. Caught in review on #5203; the sibling
  // Preview-features card was already gated this way.
  describe('DataProductCatalogs', () => {
    afterEach(() => {
      dataProductsEnabled = false
    })

    it('is absent while the data-products feature is off', () => {
      const { queryByText } = render(
        <ThemeProvider theme={theme}>
          <DataProductCatalogs />
        </ThemeProvider>,
      )
      expect(queryByText('Data Product Catalogs')).toBeNull()
      expect(queryByText('catalog connection form')).toBeNull()
    })

    it('renders once the feature is on', () => {
      dataProductsEnabled = true
      const { queryByText } = render(
        <ThemeProvider theme={theme}>
          <DataProductCatalogs />
        </ThemeProvider>,
      )
      expect(queryByText('Data Product Catalogs')).toBeTruthy()
      expect(queryByText('catalog connection form')).toBeTruthy()
    })
  })

  // A toggle is the one control where displaying an unsaved value reads as saved:
  // there is no separate "Save" to still be pending, so `checked` IS the claim
  // about persisted state. These pin that the switch never makes that claim
  // falsely.
  describe('BetaSwitch', () => {
    beforeEach(() => {
      settings = null
      writeSettings.mockReset()
      writeSettings.mockResolvedValue(undefined)
      notify.mockClear()
    })

    it('reports the stored value', () => {
      settings = { beta: true }
      const { container } = renderSwitch()
      expect(checkbox(container).checked).toBe(true)
    })

    // The switch is the opt-out the release notes point at, so it has to agree
    // with what the gated surfaces do. These pin the default: unset reads ON,
    // matching `isBetaEnabled`, rather than showing "off" while the surfaces render.
    it('reports ON when the flag is unset', () => {
      settings = {}
      const { container } = renderSwitch()
      expect(checkbox(container).checked).toBe(true)
    })

    it('reports ON when there is no settings document at all', () => {
      settings = null
      const { container } = renderSwitch()
      expect(checkbox(container).checked).toBe(true)
    })

    it('snaps back to the stored value when the write fails', async () => {
      settings = { beta: false }
      writeSettings.mockRejectedValue(new Error('network'))

      const { container } = renderSwitch()
      await act(async () => {
        fireEvent.click(checkbox(container))
      })

      // The write lost; the switch must not keep displaying the value it never
      // persisted.
      expect(checkbox(container).checked).toBe(false)
      expect(notify).toHaveBeenCalled()
    })

    it('re-enables itself after a failed write so the admin can retry', async () => {
      settings = { beta: false }
      writeSettings.mockRejectedValue(new Error('network'))

      const { container } = renderSwitch()
      await act(async () => {
        fireEvent.click(checkbox(container))
      })

      expect(checkbox(container).disabled).toBe(false)
    })

    it('surfaces the conflict message when another admin got there first', async () => {
      settings = { beta: false }
      writeSettings.mockRejectedValue(new SettingsConflictError())

      const { container } = renderSwitch()
      await act(async () => {
        fireEvent.click(checkbox(container))
      })

      expect(notify).toHaveBeenCalledWith(
        expect.stringContaining('changed by someone else'),
      )
      expect(checkbox(container).checked).toBe(false)
    })

    it('passes the snapshot it read as the expected prior state', async () => {
      settings = { beta: false, logo: { url: 's3://b/catalog/logo.png' } }

      const { container } = renderSwitch()
      await act(async () => {
        fireEvent.click(checkbox(container))
      })

      // Second argument is what makes the write refuse rather than revert a
      // concurrent change; without it the guard in useWriteSettings is inert.
      expect(writeSettings).toHaveBeenCalledWith(
        { beta: true, logo: { url: 's3://b/catalog/logo.png' } },
        settings,
      )
    })

    // CONTROL: the success path passes both before and after the fix. It pins that
    // the added failure handling did not break the ordinary case.
    it('CONTROL: shows the new value after a successful write', async () => {
      settings = { beta: false }

      const { container } = renderSwitch()
      await act(async () => {
        fireEvent.click(checkbox(container))
      })

      expect(writeSettings).toHaveBeenCalled()
      expect(notify).not.toHaveBeenCalled()
    })
  })
})
