import * as React from 'react'
import { render, cleanup, fireEvent, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as Eff from 'effect'

vi.mock('constants/config', () => ({ default: {} }))

vi.mock('./DevTools', () => ({ default: () => null }))
vi.mock('./Instructions', () => ({ default: () => null }))
vi.mock('./Input', () => ({ default: () => null }))

// The connectors service needs a live Effect runtime; these tests read the header.
vi.mock('../../Model', async (importOriginal) => {
  const Model = await importOriginal<typeof import('../../Model')>()
  return { ...Model, Connectors: { ...Model.Connectors, useIsBlocked: () => false } }
})

import Chat from './Chat'

function renderChat() {
  const props = {
    state: { _tag: 'Idle', events: [], timestamp: new Date(), error: Eff.Option.none() },
    dispatch: vi.fn(),
    devTools: {},
    connectors: { byId: {} },
    instructions: {},
    onClose: vi.fn(),
  } as unknown as React.ComponentProps<typeof Chat>
  render(<Chat {...props} />)
  return props
}

describe('components/Assistant/UI/Chat close buttons', () => {
  afterEach(cleanup)

  it('names each close button for what it closes', () => {
    const { onClose } = renderChat()
    fireEvent.click(screen.getByRole('button', { name: 'Qurator menu' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Developer Tools' }))

    const closeDevTools = screen.getByRole('button', { name: 'Close Developer Tools' })
    const closeQurator = screen.getByRole('button', { name: 'Close Qurator' })
    // Side by side, the two must not share a glyph.
    expect(closeDevTools.textContent).not.toBe(closeQurator.textContent)

    fireEvent.click(closeQurator)
    expect(onClose).toHaveBeenCalled()
  })

  it('gives every close button a tooltip matching its name', async () => {
    renderChat()
    fireEvent.click(screen.getByRole('button', { name: 'Qurator menu' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Developer Tools' }))
    for (const name of ['Close Qurator', 'Close Developer Tools']) {
      fireEvent.mouseOver(screen.getByRole('button', { name }))
      expect(await screen.findByRole('tooltip', { name })).toBeTruthy()
    }
  })
})
