import * as React from 'react'
import { render, cleanup, fireEvent, screen, act } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('constants/config', () => ({ default: { hubspotId: '123', mode: 'OPEN' } }))
vi.mock('containers/Auth', () => ({ selectors: { email: () => undefined } }))
vi.mock('react-redux', () => ({ useSelector: (s: () => unknown) => s() }))
vi.mock('react-router-dom', () => ({
  useLocation: () => ({ pathname: '/', search: '' }),
}))

import HubSpot, { EMBED_ID, useChat, useEmbed } from './HubSpot'

function Embed() {
  useEmbed()
  return <div id={EMBED_ID} />
}

function Probe() {
  const chat = useChat()
  return (
    <>
      <button onClick={chat?.show}>show</button>
      <button onClick={chat?.hide}>hide</button>
      {chat?.open && <Embed />}
    </>
  )
}

const ready = () =>
  act(() =>
    (window as any).hsConversationsOnReady.splice(0).forEach((f: () => void) => f()),
  )

describe('components/HubSpot', () => {
  afterEach(() => {
    cleanup()
    delete (window as any).HubSpotConversations
    delete (window as any).hsConversationsOnReady
    delete (window as any).hsConversationsSettings
  })

  it('never mounts the floating launcher: chat goes only into the embed element', () => {
    render(<HubSpot />)
    expect((window as any).hsConversationsSettings).toEqual({
      loadImmediately: false,
      inlineEmbedSelector: `#${EMBED_ID}`,
    })
  })

  it('loads chat while the embed is mounted, queued until HubSpot is ready', () => {
    const widget = { load: vi.fn(), remove: vi.fn() }
    render(
      <HubSpot>
        <Probe />
      </HubSpot>,
    )
    fireEvent.click(screen.getByText('show'))
    expect(document.getElementById(EMBED_ID)).toBeTruthy()
    expect(widget.load).not.toHaveBeenCalled()
    ;(window as any).HubSpotConversations = { widget }
    ready()
    expect(widget.load).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByText('hide'))
    expect(widget.remove).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByText('show'))
    expect(widget.load).toHaveBeenCalledTimes(2)
  })

  it('re-renders into a fresh panel when a close raced an unfinished load', () => {
    const widget = { load: vi.fn(), remove: vi.fn(), status: () => ({ loaded: true }) }
    ;(window as any).HubSpotConversations = { widget }
    render(
      <HubSpot>
        <Probe />
      </HubSpot>,
    )
    fireEvent.click(screen.getByText('show'))
    expect(widget.remove).toHaveBeenCalledTimes(1)
    expect(widget.load).toHaveBeenCalledTimes(1)
  })

  it('removes a chat closed before HubSpot was ready', () => {
    const widget = { load: vi.fn(), remove: vi.fn() }
    render(
      <HubSpot>
        <Probe />
      </HubSpot>,
    )
    fireEvent.click(screen.getByText('show'))
    fireEvent.click(screen.getByText('hide'))
    fireEvent.click(screen.getByText('show'))
    fireEvent.click(screen.getByText('hide'))
    // A blocked loader must not accumulate callbacks: one slot, latest op wins.
    expect((window as any).hsConversationsOnReady).toHaveLength(1)
    ;(window as any).HubSpotConversations = { widget }
    ready()
    expect(widget.load).not.toHaveBeenCalled()
    expect(widget.remove).toHaveBeenCalledTimes(1)
  })

  it('renders children without HubSpot context when no portal is configured', async () => {
    vi.resetModules()
    vi.doMock('constants/config', () => ({ default: { hubspotId: '' } }))
    const mod = await import('./HubSpot')
    function Read() {
      return <span>{String(mod.useChat())}</span>
    }
    render(
      <mod.default>
        <Read />
      </mod.default>,
    )
    expect(screen.getByText('null')).toBeTruthy()
    expect((window as any).hsConversationsSettings).toBeUndefined()
  })
})
