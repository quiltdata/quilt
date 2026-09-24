import * as React from 'react'
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { CatalogSettings } from 'utils/CatalogSettings'

vi.mock('constants/config', () => ({ default: {} }))

let settings: CatalogSettings | null = null
const writeSettings = vi.fn<
  (s: CatalogSettings, expected?: CatalogSettings | null) => Promise<void>
>(async () => {})

vi.mock('utils/CatalogSettings', () => {
  class SettingsConflictError extends Error {
    constructor() {
      super('Catalog settings were changed by someone else.')
    }
  }
  return {
    use: () => settings,
    useWriteSettings: () => writeSettings,
    SettingsConflictError,
  }
})

vi.mock('react-redux', () => ({ useSelector: () => true }))

import { SettingsConflictError } from 'utils/CatalogSettings'

import QuratorSettings from './QuratorSettings'

describe('containers/Admin/Settings/QuratorSettings', () => {
  beforeEach(() => {
    settings = { qurator: { instructions: 'Be terse' } }
    writeSettings.mockReset()
    writeSettings.mockResolvedValue(undefined)
  })
  afterEach(cleanup)

  it('Save writes the draft with the snapshot as expected prior state', async () => {
    const { getByLabelText, getByText } = render(<QuratorSettings />)
    const save = getByText('Save').closest('button')!
    expect(save.disabled).toBe(true)
    fireEvent.change(getByLabelText('Qurator instructions'), {
      target: { value: 'Answer in French' },
    })
    expect(save.disabled).toBe(false)
    await act(async () => {
      fireEvent.click(save)
    })
    expect(writeSettings).toHaveBeenCalledWith(
      { qurator: { instructions: 'Answer in French' } },
      settings,
    )
  })

  it('surfaces a conflicting write instead of swallowing it', async () => {
    writeSettings.mockRejectedValue(new SettingsConflictError())
    const { getByLabelText, getByText, getByRole } = render(<QuratorSettings />)
    fireEvent.change(getByLabelText('Qurator instructions'), {
      target: { value: 'x' },
    })
    await act(async () => {
      fireEvent.click(getByText('Save'))
    })
    expect(getByRole('alert').textContent).toContain('changed by someone else')
  })
})
