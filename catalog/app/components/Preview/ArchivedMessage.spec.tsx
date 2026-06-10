import * as React from 'react'
import { render, cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest'

import * as BucketPreferences from 'utils/BucketPreferences'
import { extendDefaults } from 'utils/BucketPreferences/BucketPreferences'

import ArchivedMessage from './ArchivedMessage'

const restoreObject = vi.fn()

// The Rehydrate CTA is gated on ui.actions.restore (default on). Drive prefs
// through a controllable mock; default to Ok+restore:true so the existing
// button-bearing tests below keep exercising the action.
const prefsHook: Mock<() => { prefs: BucketPreferences.Result }> = vi.fn(() => ({
  prefs: BucketPreferences.Result.Ok(
    extendDefaults({ ui: { actions: { restore: true } } }),
  ),
}))

vi.mock('utils/BucketPreferences', async () => ({
  ...(await vi.importActual('utils/BucketPreferences')),
  use: () => prefsHook(),
}))

const useSelector = vi.fn(() => true)
vi.mock('react-redux', () => ({
  useSelector: () => useSelector(),
}))

vi.mock('constants/config', () => ({ default: {} }))
// RehydrateDialog calls useRestoreObject() (urql-backed). Mock the hook so the
// dialog gets our stub without urql trying to hit /graphql in the test env.
vi.mock('./restoreObject', async () => {
  const actual: $TSFixMe = await vi.importActual('./restoreObject')
  return {
    ...actual,
    useRestoreObject: () => restoreObject,
  }
})

const handle = { bucket: 'B', key: 'K', version: 'V' }

// Stands in for PreviewDisplay's renderer: ArchivedMessage hands back message
// data, the host renders it (action is plain { label, onClick } data).
const renderChildren = ({ heading, body, action }: $TSFixMe) => (
  <div data-testid="message">
    <h6 data-testid="heading">{heading}</h6>
    <p data-testid="body">{body}</p>
    {action && (
      <button
        type="button"
        onClick={action.onClick}
        data-testid={`action-${action.label}`}
      >
        {action.label}
      </button>
    )}
  </div>
)

function setup(props: Partial<React.ComponentProps<typeof ArchivedMessage>> = {}) {
  return render(
    <ArchivedMessage handle={handle} {...props}>
      {renderChildren}
    </ArchivedMessage>,
  )
}

const okWithRestore = (restore: boolean) => ({
  prefs: BucketPreferences.Result.Ok(extendDefaults({ ui: { actions: { restore } } })),
})

describe('components/Preview/ArchivedMessage', () => {
  beforeEach(() => {
    restoreObject.mockReset()
    prefsHook.mockReturnValue(okWithRestore(true))
    useSelector.mockReturnValue(true)
  })
  afterEach(cleanup)

  describe('idle branch (no restore header)', () => {
    it('renders Object Archived heading with Rehydrate button', () => {
      setup()
      expect(screen.getByTestId('heading').textContent).toMatch(/Object Archived/i)
      expect(screen.getByTestId('action-Rehydrate')).toBeTruthy()
    })

    it('opens the dialog when Rehydrate is clicked', () => {
      setup()
      fireEvent.click(screen.getByTestId('action-Rehydrate'))
      expect(screen.getByRole('dialog')).toBeTruthy()
    })
  })

  describe('in-progress branch', () => {
    it('renders Restore in progress heading with no action (rehydration is async)', () => {
      setup({ archive: { storageClass: 'GLACIER', restoring: true } })
      expect(screen.getByTestId('heading').textContent).toMatch(/Restore in progress/i)
      // No in-app refresh control — restore takes hours; a later page load
      // reflects the real state.
      expect(screen.queryByTestId('action-Check status')).toBeNull()
    })
  })

  describe('optimistic restoring hold', () => {
    it('flips to in-progress immediately after a 202 callback even if restore is still undefined', async () => {
      restoreObject.mockResolvedValueOnce({
        __typename: 'RestoreObjectSuccess',
        alreadyRestored: false,
      })
      setup()
      // Open dialog and submit.
      fireEvent.click(screen.getByTestId('action-Rehydrate'))
      fireEvent.click(screen.getByRole('button', { name: /^rehydrate$/i }))
      await waitFor(() =>
        expect(screen.getByTestId('heading').textContent).toMatch(/Restore in progress/i),
      )
    })

    it('clears the optimistic hold when switching to a different object (no remount)', async () => {
      restoreObject.mockResolvedValueOnce({
        __typename: 'RestoreObjectSuccess',
        alreadyRestored: false,
      })
      const { rerender } = render(
        <ArchivedMessage handle={handle}>{renderChildren}</ArchivedMessage>,
      )
      fireEvent.click(screen.getByTestId('action-Rehydrate'))
      fireEvent.click(screen.getByRole('button', { name: /^rehydrate$/i }))
      await waitFor(() =>
        expect(screen.getByTestId('heading').textContent).toMatch(/Restore in progress/i),
      )
      // Navigate to a different archived object: same instance is reused, so the
      // previous object's optimistic "in progress" must not leak into this one.
      rerender(
        <ArchivedMessage handle={{ ...handle, key: 'OTHER_KEY' }}>
          {renderChildren}
        </ArchivedMessage>,
      )
      expect(screen.getByTestId('heading').textContent).toMatch(/Object Archived/i)
    })

    it('does NOT enter optimistic branch on 200 OK (alreadyRestored=true)', async () => {
      restoreObject.mockResolvedValueOnce({
        __typename: 'RestoreObjectSuccess',
        alreadyRestored: true,
      })
      setup()
      fireEvent.click(screen.getByTestId('action-Rehydrate'))
      fireEvent.click(screen.getByRole('button', { name: /^rehydrate$/i }))
      // 200 closes the dialog silently (no optimistic flip); the page stays on
      // "Object Archived" until reloaded — a later HEAD sees the live copy.
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
      expect(screen.getByTestId('heading').textContent).toMatch(/Object Archived/i)
    })
  })

  describe('ui.actions.restore gate', () => {
    it('hides the Rehydrate button when the preference is off', () => {
      prefsHook.mockReturnValue(okWithRestore(false))
      setup()
      // The message still renders; only the CTA is dropped.
      expect(screen.getByTestId('heading').textContent).toMatch(/Object Archived/i)
      expect(screen.queryByTestId('action-Rehydrate')).toBeNull()
    })

    it('hides the Rehydrate button while preferences are unresolved (shown only once Ok)', () => {
      prefsHook.mockReturnValue({ prefs: BucketPreferences.Result.Pending() })
      setup()
      expect(screen.getByTestId('heading').textContent).toMatch(/Object Archived/i)
      expect(screen.queryByTestId('action-Rehydrate')).toBeNull()
    })

    it('shows "Restore in progress" regardless of the flag', () => {
      prefsHook.mockReturnValue(okWithRestore(false))
      setup({ archive: { storageClass: 'GLACIER', restoring: true } })
      expect(screen.getByTestId('heading').textContent).toMatch(/Restore in progress/i)
    })
  })

  describe('authentication gate', () => {
    it('hides the Rehydrate button for anonymous users (even when the pref is on)', () => {
      useSelector.mockReturnValue(false)
      setup()
      // The message still renders; only the CTA is dropped.
      expect(screen.getByTestId('heading').textContent).toMatch(/Object Archived/i)
      expect(screen.queryByTestId('action-Rehydrate')).toBeNull()
    })

    it('shows "Restore in progress" for anonymous users (status, not an action)', () => {
      useSelector.mockReturnValue(false)
      setup({ archive: { storageClass: 'GLACIER', restoring: true } })
      expect(screen.getByTestId('heading').textContent).toMatch(/Restore in progress/i)
    })
  })
})
