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

import RehydrateDialog, { interpretResult } from './RehydrateDialog'

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
const logError = vi.hoisted(() => vi.fn())
vi.mock('utils/Logging', () => ({ default: { error: logError } }))

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

describe('interpretResult', () => {
  it('closes and flips on a 202 (new restore)', () => {
    expect(
      interpretResult({
        __typename: 'RestoreObjectSuccess',
        alreadyRestored: false,
      } as $TSFixMe),
    ).toEqual({ _tag: 'close', flip: true })
  })

  it('closes without flipping on a 200 (already restored)', () => {
    expect(
      interpretResult({
        __typename: 'RestoreObjectSuccess',
        alreadyRestored: true,
      } as $TSFixMe),
    ).toEqual({ _tag: 'close', flip: false })
  })

  it('closes and flips on RestoreAlreadyInProgress', () => {
    expect(
      interpretResult({
        __typename: 'OperationError',
        name: 'RestoreAlreadyInProgress',
      } as $TSFixMe),
    ).toEqual({ _tag: 'close', flip: true })
  })

  it('fails with the IAM hint on RestoreAccessDenied', () => {
    const o = interpretResult({
      __typename: 'OperationError',
      name: 'RestoreAccessDenied',
    } as $TSFixMe)
    expect(o._tag).toBe('failed')
    expect(o).toMatchObject({ iam: true })
  })

  it('fails (no IAM hint) on ObjectNotFound', () => {
    const o = interpretResult({
      __typename: 'OperationError',
      name: 'ObjectNotFound',
    } as $TSFixMe)
    expect(o._tag).toBe('failed')
    expect((o as $TSFixMe).iam).toBeUndefined()
  })

  it('fails with a not-accessible message on BucketNotFound', () => {
    const o = interpretResult({
      __typename: 'OperationError',
      name: 'BucketNotFound',
    } as $TSFixMe)
    expect(o._tag).toBe('failed')
    expect((o as $TSFixMe).message).toMatch(/bucket no longer exists|not accessible/i)
  })

  it('fails with the field message on InvalidInput', () => {
    expect(
      interpretResult({
        __typename: 'InvalidInput',
        errors: [{ message: 'days must be between 1 and 90' }],
      } as $TSFixMe),
    ).toEqual({ _tag: 'failed', message: 'days must be between 1 and 90' })
  })

  it('fails suggesting another tier on GlacierExpeditedUnavailable', () => {
    const o = interpretResult({
      __typename: 'OperationError',
      name: 'GlacierExpeditedUnavailable',
    } as $TSFixMe)
    expect(o._tag).toBe('failed')
    expect((o as $TSFixMe).message).toMatch(/Expedited capacity unavailable/i)
  })

  it('fails with a calm message on InvalidObjectState (not archived)', () => {
    const o = interpretResult({
      __typename: 'OperationError',
      name: 'InvalidObjectState',
    } as $TSFixMe)
    expect(o._tag).toBe('failed')
    expect((o as $TSFixMe).message).toMatch(/not archived/i)
  })

  it('logs and fails with the server message on an unknown OperationError', () => {
    logError.mockClear()
    expect(
      interpretResult({
        __typename: 'OperationError',
        name: 'SomethingNew',
        message: 'whatever the server said',
      } as $TSFixMe),
    ).toEqual({ _tag: 'failed', message: 'whatever the server said' })
    // Unknown errors are unexpected — they must be reported, not swallowed.
    expect(logError).toHaveBeenCalled()
  })
})

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
    it.each([
      ['empty', ''],
      ['below min', '0'],
      ['above max', '9999'],
      ['non-integer', '7.5'],
    ])('disables submit for an invalid value (%s)', (_label, value) => {
      setup()
      fireEvent.change(getDaysInput(), { target: { value } })
      expect(getRehydrateButton().disabled).toBe(true)
    })

    it('keeps the typed (out-of-range) value and shows the range hint', () => {
      setup()
      const days = getDaysInput()
      fireEvent.change(days, { target: { value: '9999' } })
      expect(days.value).toBe('9999')
      expect(screen.getByText(/Enter a value between 1 and 90/i)).toBeTruthy()
    })

    it('enables submit for an in-range value (90)', () => {
      setup()
      const days = getDaysInput()
      fireEvent.change(days, { target: { value: '90' } })
      expect(days.value).toBe('90')
      expect(getRehydrateButton().disabled).toBe(false)
    })
  })

  // interpretResult (tested above) owns the union -> outcome mapping. These
  // tests only verify the form wires each Outcome shape to the right effect:
  // close+flip, close-no-flip, and failed (stays open, renders the message).
  describe('submit', () => {
    it('on close+flip: calls the mutation with the form values, flips, and closes', async () => {
      restoreObject.mockResolvedValueOnce(success(false))
      const { onClose, onSubmitted } = setup()
      fireEvent.click(getRehydrateButton())
      await waitFor(() => expect(onSubmitted).toHaveBeenCalled())
      expect(restoreObject).toHaveBeenCalledWith({
        handle,
        tier: 'Standard',
        days: 7,
      })
      expect(onClose).toHaveBeenCalled()
    })

    it('on close-no-flip: closes without flipping (200 already restored)', async () => {
      restoreObject.mockResolvedValueOnce(success(true))
      const { onClose, onSubmitted } = setup()
      fireEvent.click(getRehydrateButton())
      await waitFor(() => expect(onClose).toHaveBeenCalled())
      expect(onSubmitted).not.toHaveBeenCalled()
    })

    it('on failed: stays open and renders the message (+ IAM hint when set)', async () => {
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
  })
})
