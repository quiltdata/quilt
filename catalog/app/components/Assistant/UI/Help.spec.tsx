import * as React from 'react'
import { render, cleanup, act, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('components/HubSpot', () => ({ EMBED_ID: 'hs-chat-panel', useEmbed: () => {} }))

import Help from './Help'

describe('components/Assistant/UI/Help', () => {
  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  it('offers email when the chat never arrives', () => {
    vi.useFakeTimers()
    render(<Help onClose={() => {}} />)
    expect(screen.queryByText(/isn't available/)).toBeNull()
    act(() => {
      vi.advanceTimersByTime(15_000)
    })
    expect(screen.getByText(/isn't available/)).toBeTruthy()
  })

  it('clears the notice when a slow chat arrives', async () => {
    vi.useFakeTimers()
    render(<Help onClose={() => {}} />)
    act(() => {
      vi.advanceTimersByTime(15_000)
    })
    expect(screen.getByText(/isn't available/)).toBeTruthy()
    vi.useRealTimers()
    document
      .getElementById('hs-chat-panel')!
      .appendChild(document.createElement('iframe'))
    await act(() => new Promise((r) => setTimeout(r, 0)))
    expect(screen.queryByText(/isn't available/)).toBeNull()
  })

  it('says nothing once the chat iframe is in place', () => {
    vi.useFakeTimers()
    render(<Help onClose={() => {}} />)
    document
      .getElementById('hs-chat-panel')!
      .appendChild(document.createElement('iframe'))
    act(() => {
      vi.advanceTimersByTime(15_000)
    })
    expect(screen.queryByText(/isn't available/)).toBeNull()
  })

  it('moves focus to its close button', () => {
    render(<Help onClose={() => {}} />)
    expect(document.activeElement).toBe(screen.getByLabelText('Close Help'))
  })
})
