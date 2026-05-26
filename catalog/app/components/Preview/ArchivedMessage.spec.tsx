import * as React from 'react'
import { render, cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import ArchivedMessage from './ArchivedMessage'

const push = vi.fn()
const restoreObject = vi.fn()

vi.mock('constants/config', () => ({ default: {} }))
vi.mock('utils/AWS', () => ({ S3: { use: () => ({}) } }))
vi.mock('containers/Notifications', () => ({ use: () => ({ push }) }))
vi.mock('containers/Bucket/requests', async () => {
  const actual: $TSFixMe = await vi.importActual('containers/Bucket/requests/object')
  return {
    ...actual,
    restoreObject: (...args: $TSFixMe[]) => restoreObject(...args),
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
  const onReload = vi.fn()
  const utils = render(
    <ArchivedMessage
      handle={handle}
      renderMessage={renderMessage}
      renderAction={renderAction}
      onReload={onReload}
      {...props}
    />,
  )
  return { ...utils, onReload }
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
    it('renders Restore in progress heading with Check status button', () => {
      setup({ restore: { ongoing: true } })
      expect(screen.getByTestId('heading').textContent).toMatch(/Restore in progress/i)
      expect(screen.getByTestId('action-Check status')).toBeTruthy()
    })

    it('Check status calls onReload', () => {
      const { onReload } = setup({ restore: { ongoing: true } })
      fireEvent.click(screen.getByTestId('action-Check status'))
      expect(onReload).toHaveBeenCalled()
    })

    it('hides Check status when onReload is absent', () => {
      render(
        <ArchivedMessage
          handle={handle}
          restore={{ ongoing: true }}
          renderMessage={renderMessage}
          renderAction={renderAction}
        />,
      )
      expect(screen.getByTestId('heading').textContent).toMatch(/Restore in progress/i)
      expect(screen.queryByTestId('action-Check status')).toBeNull()
    })
  })

  describe('optimistic restoring hold', () => {
    it('flips to in-progress immediately after a 202 callback even if restore is still undefined', async () => {
      restoreObject.mockResolvedValueOnce({ alreadyRestored: false })
      setup()
      // Open dialog and submit.
      fireEvent.click(screen.getByTestId('action-Rehydrate'))
      fireEvent.click(screen.getByRole('button', { name: /^rehydrate$/i }))
      await waitFor(() =>
        expect(screen.getByTestId('heading').textContent).toMatch(/Restore in progress/i),
      )
    })

    it('clears optimistic state once HEAD-derived ongoing=true arrives, staying in in-progress branch', async () => {
      restoreObject.mockResolvedValueOnce({ alreadyRestored: false })
      const onReload = vi.fn()
      const { rerender } = render(
        <ArchivedMessage
          handle={handle}
          renderMessage={renderMessage}
          renderAction={renderAction}
          onReload={onReload}
        />,
      )
      fireEvent.click(screen.getByTestId('action-Rehydrate'))
      fireEvent.click(screen.getByRole('button', { name: /^rehydrate$/i }))
      await waitFor(() =>
        expect(screen.getByTestId('heading').textContent).toMatch(/Restore in progress/i),
      )
      // Simulate parent refetch landing HEAD-derived ongoing=true.
      rerender(
        <ArchivedMessage
          handle={handle}
          restore={{ ongoing: true }}
          renderMessage={renderMessage}
          renderAction={renderAction}
          onReload={onReload}
        />,
      )
      // Still in-progress, no flicker back to idle.
      expect(screen.getByTestId('heading').textContent).toMatch(/Restore in progress/i)
    })

    it('does NOT enter optimistic branch on 200 OK (alreadyRestored=true)', async () => {
      restoreObject.mockResolvedValueOnce({ alreadyRestored: true })
      const onReload = vi.fn()
      setup({ onReload })
      fireEvent.click(screen.getByTestId('action-Rehydrate'))
      fireEvent.click(screen.getByRole('button', { name: /^rehydrate$/i }))
      await waitFor(() => expect(onReload).toHaveBeenCalled())
      // No optimistic flip — heading still says Object Archived. Parent will
      // unmount/replace this component once `effectivelyArchived === false`.
      expect(screen.getByTestId('heading').textContent).toMatch(/Object Archived/i)
    })
  })
})
