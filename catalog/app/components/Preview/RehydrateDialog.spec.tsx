import * as React from 'react'
import {
  render,
  cleanup,
  fireEvent,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import RehydrateDialog from './RehydrateDialog'

const restoreObject = vi.fn()

// useRestoreObject now returns the raw mutation union; the dialog branches on it.
const success = (alreadyRestored: boolean) => ({
  __typename: 'RestoreObjectSuccess' as const,
  alreadyRestored,
})
const opError = (name: string) => ({
  __typename: 'OperationError' as const,
  name,
  message: `server: ${name}`,
})

vi.mock('constants/config', () => ({ default: {} }))

vi.mock('./restoreObject', async () => {
  const actual: $TSFixMe = await vi.importActual('./restoreObject')
  return {
    ...actual,
    useRestoreObject: () => restoreObject,
  }
})

const handle = { bucket: 'B', key: 'K', version: 'V' }

function setup(overrides?: Partial<React.ComponentProps<typeof RehydrateDialog>>) {
  const onClose = vi.fn()
  const onSubmitted = vi.fn()
  const utils = render(
    <RehydrateDialog
      open
      onClose={onClose}
      handle={handle}
      onSubmitted={onSubmitted}
      {...overrides}
    />,
  )
  return { ...utils, onClose, onSubmitted }
}

function getDaysInput(): HTMLInputElement {
  return screen.getByLabelText(/Restore duration in days/i) as HTMLInputElement
}

function getTierSelect(): HTMLSelectElement {
  return screen.getByLabelText(/Retrieval tier/i) as HTMLSelectElement
}

function getRehydrateButton(): HTMLButtonElement {
  return screen.getByRole('button', {
    name: /^rehydrate$|^submitting/i,
  }) as HTMLButtonElement
}

describe('components/Preview/RehydrateDialog', () => {
  beforeEach(() => {
    restoreObject.mockReset()
  })
  afterEach(cleanup)

  it('renders with Standard tier and 7 days defaults', () => {
    setup()
    expect(getTierSelect().value).toBe('Standard')
    expect(getDaysInput().value).toBe('7')
  })

  it('allows selecting Expedited tier', () => {
    setup()
    const tier = getTierSelect()
    fireEvent.change(tier, { target: { value: 'Expedited' } })
    expect(tier.value).toBe('Expedited')
  })

  it('offers Expedited for GLACIER', () => {
    setup({ storageClass: 'GLACIER' })
    const values = Array.from(getTierSelect().options).map((o) => o.value)
    expect(values).toEqual(['Standard', 'Bulk', 'Expedited'])
  })

  it('hides Expedited for DEEP_ARCHIVE', () => {
    setup({ storageClass: 'DEEP_ARCHIVE' })
    const values = Array.from(getTierSelect().options).map((o) => o.value)
    expect(values).toEqual(['Standard', 'Bulk'])
  })

  describe('days validation', () => {
    it('disables submit when input is empty', () => {
      setup()
      const days = getDaysInput()
      fireEvent.change(days, { target: { value: '' } })
      expect(getRehydrateButton().disabled).toBe(true)
      expect(screen.getByText(/Enter a value between 1 and 90/i)).toBeTruthy()
    })

    it('keeps the typed value and disables submit when above max', () => {
      setup()
      const days = getDaysInput()
      fireEvent.change(days, { target: { value: '9999' } })
      expect(days.value).toBe('9999')
      expect(getRehydrateButton().disabled).toBe(true)
      expect(screen.getByText(/Enter a value between 1 and 90/i)).toBeTruthy()
    })

    it('keeps the typed value and disables submit when below min', () => {
      setup()
      const days = getDaysInput()
      fireEvent.change(days, { target: { value: '0' } })
      expect(days.value).toBe('0')
      expect(getRehydrateButton().disabled).toBe(true)
    })

    it('disables submit for a non-integer value', () => {
      setup()
      const days = getDaysInput()
      fireEvent.change(days, { target: { value: '7.5' } })
      expect(getRehydrateButton().disabled).toBe(true)
    })

    it('enables submit for an in-range value (90)', () => {
      setup()
      const days = getDaysInput()
      fireEvent.change(days, { target: { value: '90' } })
      expect(days.value).toBe('90')
      expect(getRehydrateButton().disabled).toBe(false)
    })
  })

  describe('submit', () => {
    it('flips to in-progress and closes on a new restore', async () => {
      restoreObject.mockResolvedValueOnce(success(false))
      const { onClose, onSubmitted } = setup()
      fireEvent.click(getRehydrateButton())
      await waitFor(() => expect(onSubmitted).toHaveBeenCalledWith(false))
      expect(restoreObject).toHaveBeenCalledWith({
        handle,
        tier: 'Standard',
        days: 7,
      })
      expect(onClose).toHaveBeenCalled()
    })

    it('closes silently when already restored (200 — no page feedback by design)', async () => {
      restoreObject.mockResolvedValueOnce(success(true))
      const { onClose, onSubmitted } = setup()
      fireEvent.click(getRehydrateButton())
      await waitFor(() => expect(onClose).toHaveBeenCalled())
      // No optimistic flip on 200; the page stays archived until reloaded.
      expect(onSubmitted).toHaveBeenCalledWith(true)
    })

    it('flips to in-progress and closes on RestoreAlreadyInProgress', async () => {
      restoreObject.mockResolvedValueOnce(opError('RestoreAlreadyInProgress'))
      const { onClose, onSubmitted } = setup()
      fireEvent.click(getRehydrateButton())
      await waitFor(() => expect(onClose).toHaveBeenCalled())
      // already running → trigger the in-progress flip (treated like a new restore).
      expect(onSubmitted).toHaveBeenCalledWith(false)
    })

    it('stays open and surfaces the error + IAM hint on RestoreAccessDenied', async () => {
      restoreObject.mockResolvedValueOnce(opError('RestoreAccessDenied'))
      const { onClose, onSubmitted } = setup()
      fireEvent.click(getRehydrateButton())
      const dialog = screen.getByRole('dialog')
      await waitFor(() =>
        expect(within(dialog).getByText(/permission to rehydrate/i)).toBeTruthy(),
      )
      expect(within(dialog).getByText(/s3:RestoreObject/)).toBeTruthy()
      expect(onClose).not.toHaveBeenCalled()
      expect(onSubmitted).not.toHaveBeenCalled()
    })

    it('stays open and suggests another tier on GlacierExpeditedUnavailable', async () => {
      restoreObject.mockResolvedValueOnce(opError('GlacierExpeditedUnavailable'))
      const { onClose } = setup()
      fireEvent.click(getRehydrateButton())
      const dialog = screen.getByRole('dialog')
      await waitFor(() =>
        expect(within(dialog).getByText(/Expedited capacity unavailable/i)).toBeTruthy(),
      )
      expect(onClose).not.toHaveBeenCalled()
    })

    it('shows a calm message on InvalidObjectState (not archived)', async () => {
      restoreObject.mockResolvedValueOnce(opError('InvalidObjectState'))
      const { onClose } = setup()
      fireEvent.click(getRehydrateButton())
      const dialog = screen.getByRole('dialog')
      await waitFor(() => expect(within(dialog).getByText(/not archived/i)).toBeTruthy())
      expect(onClose).not.toHaveBeenCalled()
    })

    it('shows a calm message on ObjectNotFound (deleted)', async () => {
      restoreObject.mockResolvedValueOnce(opError('ObjectNotFound'))
      const { onClose } = setup()
      fireEvent.click(getRehydrateButton())
      const dialog = screen.getByRole('dialog')
      await waitFor(() =>
        expect(within(dialog).getByText(/no longer exists/i)).toBeTruthy(),
      )
      expect(onClose).not.toHaveBeenCalled()
    })
  })
})
