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

import {
  RestoreAlreadyInProgressError,
  RestoreAccessDeniedError,
} from 'containers/Bucket/requests/object'

import RehydrateDialog from './RehydrateDialog'

const push = vi.fn()
const restoreObject = vi.fn()

vi.mock('constants/config', () => ({ default: {} }))

vi.mock('utils/AWS', () => ({
  S3: { use: () => ({}) },
}))

vi.mock('containers/Notifications', () => ({
  use: () => ({ push }),
}))

vi.mock('containers/Bucket/requests', async () => {
  const actual: $TSFixMe = await vi.importActual('containers/Bucket/requests/object')
  return {
    ...actual,
    restoreObject: (...args: $TSFixMe[]) => restoreObject(...args),
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

function getRehydrateButton(): HTMLButtonElement {
  return screen.getByRole('button', {
    name: /^rehydrate$|^submitting/i,
  }) as HTMLButtonElement
}

describe('components/Preview/RehydrateDialog', () => {
  beforeEach(() => {
    push.mockReset()
    restoreObject.mockReset()
  })
  afterEach(cleanup)

  it('renders with Standard tier and 7 days defaults', () => {
    setup()
    const standardRadio = screen.getByRole('radio', { name: /Standard/i })
    expect((standardRadio as HTMLInputElement).checked).toBe(true)
    expect(getDaysInput().value).toBe('7')
  })

  it('allows selecting Expedited tier', () => {
    setup()
    const expedited = screen.getByRole('radio', { name: /Expedited/i })
    fireEvent.click(expedited)
    expect((expedited as HTMLInputElement).checked).toBe(true)
  })

  describe('days validation', () => {
    it('disables submit when input is empty', () => {
      setup()
      const days = getDaysInput()
      fireEvent.change(days, { target: { value: '' } })
      expect(getRehydrateButton().disabled).toBe(true)
      expect(screen.getByText(/Enter a value between 1 and 90/i)).toBeTruthy()
    })

    it('clamps typed value 9999 to 90', () => {
      setup()
      const days = getDaysInput()
      fireEvent.change(days, { target: { value: '9999' } })
      expect(days.value).toBe('90')
      expect(getRehydrateButton().disabled).toBe(false)
    })

    it('clamps 0 to 1 (minimum)', () => {
      setup()
      const days = getDaysInput()
      fireEvent.change(days, { target: { value: '0' } })
      expect(days.value).toBe('1')
      expect(getRehydrateButton().disabled).toBe(false)
    })

    it('clamps negative values to 1', () => {
      setup()
      const days = getDaysInput()
      fireEvent.change(days, { target: { value: '-1' } })
      expect(days.value).toBe('1')
    })

    it('accepts in-range value 90', () => {
      setup()
      const days = getDaysInput()
      fireEvent.change(days, { target: { value: '90' } })
      expect(days.value).toBe('90')
      expect(getRehydrateButton().disabled).toBe(false)
    })
  })

  describe('submit', () => {
    it('calls restoreObject and pushes "initiated" toast on 202', async () => {
      restoreObject.mockResolvedValueOnce({ alreadyRestored: false })
      const { onClose, onSubmitted } = setup()
      fireEvent.click(getRehydrateButton())
      await waitFor(() => expect(onSubmitted).toHaveBeenCalledWith(false))
      expect(restoreObject).toHaveBeenCalledWith({
        s3: expect.anything(),
        handle,
        tier: 'Standard',
        days: 7,
      })
      expect(push).toHaveBeenCalledWith(expect.stringMatching(/initiated/i))
      expect(onClose).toHaveBeenCalled()
    })

    it('pushes "extended" toast on 200 (already restored)', async () => {
      restoreObject.mockResolvedValueOnce({ alreadyRestored: true })
      const { onSubmitted } = setup()
      fireEvent.click(getRehydrateButton())
      await waitFor(() => expect(onSubmitted).toHaveBeenCalledWith(true))
      expect(push).toHaveBeenCalledWith(expect.stringMatching(/extended to 7 days/i))
    })

    it('closes on 409 RestoreAlreadyInProgress', async () => {
      restoreObject.mockRejectedValueOnce(new RestoreAlreadyInProgressError())
      const { onClose, onSubmitted } = setup()
      fireEvent.click(getRehydrateButton())
      await waitFor(() => expect(onClose).toHaveBeenCalled())
      expect(onSubmitted).not.toHaveBeenCalled()
      expect(push).toHaveBeenCalledWith(expect.stringMatching(/already in progress/i))
    })

    it('stays open and surfaces the error + IAM hint on 403 AccessDenied', async () => {
      restoreObject.mockRejectedValueOnce(new RestoreAccessDeniedError())
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
