import * as React from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, it, expect, vi } from 'vitest'

import noop from 'utils/noop'

vi.mock('constants/config', () => ({ default: {} }))

import Input, { ModelPicker } from './Input'

describe('components/Assistant/UI/Chat/Input', () => {
  it('labels the chat field', () => {
    const { getByRole } = render(<Input onSubmit={noop} />)
    expect(getByRole('textbox', { name: 'Ask Qurator' })).toBeTruthy()
  })

  it('labels the send button', () => {
    const { getByRole } = render(<Input onSubmit={noop} />)
    expect(getByRole('button', { name: 'Send' })).toBeTruthy()
  })
})

describe('components/Assistant/UI/Chat/Input ModelPicker', () => {
  afterEach(cleanup)

  const HAIKU = 'us.anthropic.claude-haiku-4-5-20251001-v1:0'
  const OPUS = 'us.anthropic.claude-opus-4-5-20251101-v1:0'

  it('shows the current tier and offers exactly the approved models', () => {
    render(
      <ModelPicker
        model={{ allowlist: [HAIKU, OPUS], current: OPUS, select: vi.fn() }}
      />,
    )
    const button = screen.getByLabelText('Model: Heavy · Claude Opus 4.5')
    expect(button.textContent).toContain('Heavy')
    fireEvent.click(button)
    const items = screen.getAllByRole('menuitemradio')
    expect(items.map((i) => i.textContent)).toEqual([
      'Light · Claude Haiku 4.5',
      'Heavy · Claude Opus 4.5',
    ])
    expect(items.map((i) => i.getAttribute('aria-checked'))).toEqual(['false', 'true'])
  })

  it('selects a model', () => {
    const select = vi.fn()
    render(<ModelPicker model={{ allowlist: [HAIKU, OPUS], current: OPUS, select }} />)
    fireEvent.click(screen.getByLabelText(/^Model:/))
    fireEvent.click(screen.getByText('Light · Claude Haiku 4.5'))
    expect(select).toHaveBeenCalledWith(HAIKU)
  })

  it('is absent on a stack with no approved set', () => {
    render(<ModelPicker model={{ allowlist: null, current: OPUS, select: vi.fn() }} />)
    expect(screen.queryByLabelText(/^Model:/)).toBeNull()
  })

  it('is disabled while a turn is in flight', () => {
    render(
      <ModelPicker
        model={{ allowlist: [HAIKU, OPUS], current: OPUS, select: vi.fn() }}
        disabled
      />,
    )
    expect((screen.getByLabelText(/^Model:/) as HTMLButtonElement).disabled).toBe(true)
  })
})
