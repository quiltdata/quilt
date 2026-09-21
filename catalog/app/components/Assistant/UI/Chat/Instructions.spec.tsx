import * as React from 'react'
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('constants/config', () => ({ default: {} }))

import { SettingsConflictError } from 'utils/CatalogSettings'

import type * as Model from '../../Model'

import Instructions from './Instructions'

type Overrides = Partial<Model.UserInstructions.UserInstructions>

// The strip only renders what the hook hands it; the hook is covered in
// Model/UserInstructions.spec. Here: admin vs non-admin surface, Save commits
// the draft, and a failed write is shown rather than swallowed.
const make = (o: Overrides = {}): Model.UserInstructions.UserInstructions => {
  const text = o.text ?? ''
  const enabled = o.enabled ?? true
  return {
    text,
    enabled,
    active: enabled && !!text.trim(),
    canEdit: true,
    setText: vi.fn(async () => {}),
    setEnabled: vi.fn(async () => {}),
    clear: vi.fn(async () => {}),
    ...o,
  }
}

const expandStrip = (getByLabelText: (label: string) => HTMLElement) =>
  fireEvent.click(getByLabelText('Expand Qurator instructions'))

describe('components/Assistant/UI/Chat/Instructions', () => {
  afterEach(cleanup)

  it('starts collapsed with the editor hidden', () => {
    const { getByLabelText, queryByLabelText } = render(
      <Instructions instructions={make()} />,
    )
    expect(
      getByLabelText('Expand Qurator instructions').getAttribute('aria-expanded'),
    ).toBe('false')
    expect(queryByLabelText('Collapse Qurator instructions')).toBeNull()
  })

  it('shows the "Instructions on" chip when active', () => {
    const { getByText } = render(
      <Instructions instructions={make({ text: 'Be terse' })} />,
    )
    expect(getByText('Instructions on')).toBeTruthy()
  })

  it('shows "Muted" when text is set but disabled', () => {
    const { getByText, queryByText } = render(
      <Instructions instructions={make({ text: 'Be terse', enabled: false })} />,
    )
    expect(queryByText('Instructions on')).toBeNull()
    expect(getByText('Muted')).toBeTruthy()
  })

  it('admin: Save commits the draft, not each keystroke', async () => {
    const instructions = make()
    const { getByLabelText, getByText } = render(
      <Instructions instructions={instructions} />,
    )
    expandStrip(getByLabelText)
    fireEvent.change(getByLabelText('Qurator instructions'), {
      target: { value: 'Answer in French' },
    })
    expect(instructions.setText).not.toHaveBeenCalled()
    await act(async () => {
      fireEvent.click(getByText('Save'))
    })
    expect(instructions.setText).toHaveBeenCalledWith('Answer in French')
  })

  it('admin: the switch mutes and Clear erases', async () => {
    const instructions = make({ text: 'Be terse' })
    const { container, getByLabelText, getByText } = render(
      <Instructions instructions={instructions} />,
    )
    expandStrip(getByLabelText)
    await act(async () => {
      fireEvent.click(container.querySelector('input[type="checkbox"]')!)
    })
    expect(instructions.setEnabled).toHaveBeenCalledWith(false)
    await act(async () => {
      fireEvent.click(getByText('Clear'))
    })
    expect(instructions.clear).toHaveBeenCalled()
  })

  it('admin: a conflicting write surfaces its message', async () => {
    const instructions = make({
      setText: vi.fn(async () => {
        throw new SettingsConflictError()
      }),
    })
    const { getByLabelText, getByText, getByRole } = render(
      <Instructions instructions={instructions} />,
    )
    expandStrip(getByLabelText)
    fireEvent.change(getByLabelText('Qurator instructions'), {
      target: { value: 'x' },
    })
    await act(async () => {
      fireEvent.click(getByText('Save'))
    })
    expect(getByRole('alert').textContent).toContain('changed by someone else')
  })

  it('non-admin: read-only text, no controls', () => {
    const { getByLabelText, getByText, queryByLabelText, queryByText } = render(
      <Instructions instructions={make({ text: 'Be terse', canEdit: false })} />,
    )
    expandStrip(getByLabelText)
    expect(getByText('Be terse')).toBeTruthy()
    expect(queryByLabelText('Qurator instructions')).toBeNull()
    expect(queryByText('Save')).toBeNull()
    expect(queryByText('Clear')).toBeNull()
  })
})
