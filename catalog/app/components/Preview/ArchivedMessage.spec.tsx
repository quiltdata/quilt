import * as React from 'react'
import { render, cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import ArchivedMessage from './ArchivedMessage'

const push = vi.fn()
const restoreObject = vi.fn()

vi.mock('constants/config', () => ({ default: {} }))
vi.mock('containers/Notifications', () => ({ use: () => ({ push }) }))
// RehydrateDialog now calls useRestoreObject() (urql-backed) instead of the
// AWS-SDK requests.restoreObject. Mock the hook so the dialog gets our stub
// without urql trying to hit /graphql in the test environment.
vi.mock('./restoreObject', async () => {
  const actual: $TSFixMe = await vi.importActual('./restoreObject')
  return {
    ...actual,
    useRestoreObject: () => restoreObject,
  }
})

const handle = { bucket: 'B', key: 'K', version: 'V' }

const renderMessage = ({ heading, body, action }: $TSFixMe) => (
  <div data-testid="message">
    <h6 data-testid="heading">{heading}</h6>
    <p data-testid="body">{body}</p>
    {action}
  </div>
)

const renderAction = ({ label, onClick }: $TSFixMe) => (
  <button type="button" onClick={onClick} data-testid={`action-${label}`}>
    {label}
  </button>
)

function setup(props: Partial<React.ComponentProps<typeof ArchivedMessage>> = {}) {
  return render(
    <ArchivedMessage
      handle={handle}
      renderMessage={renderMessage}
      renderAction={renderAction}
      {...props}
    />,
  )
}

describe('components/Preview/ArchivedMessage', () => {
  beforeEach(() => {
    push.mockReset()
    restoreObject.mockReset()
  })
  afterEach(cleanup)

  describe('idle branch (no restore header)', () => {
    it('renders Object Archived heading with Rehydrate button', () => {
      setup()
      expect(screen.getByTestId('heading').textContent).toMatch(/Object Archived/i)
      expect(screen.getByTestId('action-Rehydrate')).toBeTruthy()
    })

    it('hides Rehydrate when noDownload is true', () => {
      setup({ noDownload: true })
      expect(screen.getByTestId('heading').textContent).toMatch(/Object Archived/i)
      expect(screen.queryByTestId('action-Rehydrate')).toBeNull()
    })

    it('opens the dialog when Rehydrate is clicked', () => {
      setup()
      fireEvent.click(screen.getByTestId('action-Rehydrate'))
      expect(screen.getByRole('dialog')).toBeTruthy()
    })

    it('falls back to idle branch when expiresAt < now (defensive)', () => {
      const past = new Date(Date.now() - 1000)
      setup({ restore: { ongoing: false, expiresAt: past } })
      expect(screen.getByTestId('heading').textContent).toMatch(/Object Archived/i)
    })
  })

  describe('in-progress branch', () => {
    it('renders Restore in progress heading with no action (rehydration is async)', () => {
      setup({ restore: { ongoing: true } })
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

    it('holds in-progress when HEAD-derived ongoing=true later arrives (no remount/flicker)', async () => {
      restoreObject.mockResolvedValueOnce({
        __typename: 'RestoreObjectSuccess',
        alreadyRestored: false,
      })
      const { rerender } = render(
        <ArchivedMessage
          handle={handle}
          renderMessage={renderMessage}
          renderAction={renderAction}
        />,
      )
      fireEvent.click(screen.getByTestId('action-Rehydrate'))
      fireEvent.click(screen.getByRole('button', { name: /^rehydrate$/i }))
      await waitFor(() =>
        expect(screen.getByTestId('heading').textContent).toMatch(/Restore in progress/i),
      )
      // Simulate a fresh HEAD arriving with ongoing=true.
      rerender(
        <ArchivedMessage
          handle={handle}
          restore={{ ongoing: true }}
          renderMessage={renderMessage}
          renderAction={renderAction}
        />,
      )
      expect(screen.getByTestId('heading').textContent).toMatch(/Restore in progress/i)
    })

    it('does NOT enter optimistic branch on 200 OK (alreadyRestored=true)', async () => {
      restoreObject.mockResolvedValueOnce({
        __typename: 'RestoreObjectSuccess',
        alreadyRestored: true,
      })
      setup()
      fireEvent.click(screen.getByTestId('action-Rehydrate'))
      fireEvent.click(screen.getByRole('button', { name: /^rehydrate$/i }))
      // Success is reported via a notification; wait for it, then confirm we
      // stayed on the archived branch (no optimistic flip on 200 — a later page
      // load flips out of "archived" once the HEAD sees the live copy).
      await waitFor(() => expect(push).toHaveBeenCalled())
      expect(screen.getByTestId('heading').textContent).toMatch(/Object Archived/i)
    })
  })
})
