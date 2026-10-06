import * as React from 'react'
import { render, cleanup, fireEvent, screen, act } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('constants/config', () => ({ default: { hubspotId: '123', mode: 'OPEN' } }))
vi.mock('containers/Auth', () => ({ selectors: { email: () => undefined } }))
vi.mock('react-redux', () => ({ useSelector: (s: () => unknown) => s() }))
vi.mock('react-router-dom', () => ({
  useLocation: () => ({ pathname: '/', search: '' }),
}))

import HubSpot, { useChat } from './HubSpot'

function OpenChat() {
  const chat = useChat()
  return <button onClick={chat?.show}>{chat?.label}</button>
}

describe('components/HubSpot chat panel', () => {
  afterEach(() => {
    cleanup()
    delete (window as any).HubSpotConversations
    delete (window as any).hsConversationsOnReady
    delete (window as any).hsConversationsSettings
  })

  it('embeds chat only in the panel: no floating launcher, load on open, remove on close', () => {
    render(
      <HubSpot>
        <OpenChat />
      </HubSpot>,
    )
    expect((window as any).hsConversationsSettings).toEqual({
      loadImmediately: false,
      inlineEmbedSelector: '#hs-chat-panel',
    })

    const widget = { load: vi.fn(), remove: vi.fn() }
    const opener = screen.getByRole('button', { name: 'Talk to Sales' })
    opener.focus()
    fireEvent.click(opener)
    expect(document.getElementById('hs-chat-panel')).toBeTruthy()
    expect(document.activeElement).toBe(screen.getByLabelText('Close chat'))
    // Loader not ready yet: the load is queued, then runs when HubSpot calls back.
    expect(widget.load).not.toHaveBeenCalled()
    ;(window as any).HubSpotConversations = { widget }
    act(() => (window as any).hsConversationsOnReady.forEach((f: () => void) => f()))
    expect(widget.load).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByLabelText('Close chat'))
    expect(widget.remove).toHaveBeenCalledTimes(1)
    expect(document.activeElement).toBe(opener)

    fireEvent.click(screen.getByRole('button', { name: 'Talk to Sales' }))
    expect(widget.load).toHaveBeenCalledTimes(2)
  })

  it('closing before HubSpot is ready runs load, then remove, once ready', () => {
    render(
      <HubSpot>
        <OpenChat />
      </HubSpot>,
    )
    const calls: string[] = []
    const widget = { load: () => calls.push('load'), remove: () => calls.push('remove') }
    fireEvent.click(screen.getByRole('button', { name: 'Talk to Sales' }))
    fireEvent.click(screen.getByLabelText('Close chat'))
    ;(window as any).HubSpotConversations = { widget }
    act(() => (window as any).hsConversationsOnReady.forEach((f: () => void) => f()))
    expect(calls).toEqual(['load', 'remove'])
  })
})
