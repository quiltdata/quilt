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
    expect(screen.queryByText(/didn't load/)).toBeNull()
    act(() => {
      vi.advanceTimersByTime(15_000)
    })
    expect(screen.getByText(/didn't load/)).toBeTruthy()
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
    expect(screen.queryByText(/didn't load/)).toBeNull()
  })

  it('moves focus to its close button', () => {
    render(<Help onClose={() => {}} />)
    expect(document.activeElement).toBe(screen.getByLabelText('Close Help'))
  })
})
