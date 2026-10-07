import * as React from 'react'
import { render, cleanup, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('components/HubSpot', () => ({ EMBED_ID: 'hs-chat-panel', useEmbed: () => {} }))

import Help from './Help'

describe('components/Assistant/UI/Help', () => {
  afterEach(cleanup)

  it('always offers email, since the page cannot tell whether the chat works', () => {
    render(<Help onClose={() => {}} />)
    document
      .getElementById('hs-chat-panel')!
      .appendChild(document.createElement('iframe'))
    expect(screen.getByRole('link', { name: 'support@quilt.bio' })).toBeTruthy()
  })

  it('moves focus to its close button', () => {
    render(<Help onClose={() => {}} />)
    expect(document.activeElement).toBe(screen.getByLabelText('Close Help'))
  })
})
