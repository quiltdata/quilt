import * as React from 'react'
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('constants/config', () => ({ default: {} }))

import { SettingsConflictError } from 'utils/CatalogSettings'

import type * as Model from '../../Model'

import Instructions from './Instructions'

type Layer = Model.UserInstructions.Instructions
type Overrides = Partial<Layer>

// The strip only renders what the hooks hand it; the hooks are covered in
// Model/UserInstructions.spec. Here: the two layers stay separate (own chips,
// own fields, own controls), admin vs non-admin on the global section, Save
// commits the draft, and a failed write is shown rather than swallowed.
const make = (o: Overrides = {}): Layer => {
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

const dual = (global: Overrides = {}, personal: Overrides = {}) => ({
  global: make(global),
  personal: make(personal),
})

const expandStrip = (getByLabelText: (label: string) => HTMLElement) =>
  fireEvent.click(getByLabelText('Expand Qurator instructions'))

const GLOBAL_FIELD = 'Global Qurator instructions'
const PERSONAL_FIELD = 'Personal Qurator notes'

describe('components/Assistant/UI/Chat/Instructions', () => {
  afterEach(cleanup)

  it('starts collapsed with both editors hidden', () => {
    const { getByLabelText, queryByLabelText } = render(
      <Instructions instructions={dual()} />,
    )
    expect(
      getByLabelText('Expand Qurator instructions').getAttribute('aria-expanded'),
    ).toBe('false')
    expect(queryByLabelText('Collapse Qurator instructions')).toBeNull()
  })

  describe('chips', () => {
    it('shows only the global chip when only global is active', () => {
      const { getByText, queryByText } = render(
        <Instructions instructions={dual({ text: 'Be terse' })} />,
      )
      expect(getByText('Global on')).toBeTruthy()
      expect(queryByText('Personal on')).toBeNull()
    })

    it('shows only the personal chip when only personal is active', () => {
      const { getByText, queryByText } = render(
        <Instructions instructions={dual({}, { text: 'Prefer Parquet' })} />,
      )
      expect(getByText('Personal on')).toBeTruthy()
      expect(queryByText('Global on')).toBeNull()
    })

    it('shows both chips when both layers are active', () => {
      const { getByText } = render(
        <Instructions
          instructions={dual({ text: 'Be terse' }, { text: 'Prefer Parquet' })}
        />,
      )
      expect(getByText('Global on')).toBeTruthy()
      expect(getByText('Personal on')).toBeTruthy()
    })

    it('distinguishes muted layers per side', () => {
      const { getByText, queryByText } = render(
        <Instructions
          instructions={dual(
            { text: 'Be terse', enabled: false },
            { text: 'Prefer Parquet' },
          )}
        />,
      )
      expect(getByText('Global muted')).toBeTruthy()
      expect(getByText('Personal on')).toBeTruthy()
      expect(queryByText('Global on')).toBeNull()
      expect(queryByText('Personal muted')).toBeNull()
    })

    it('shows no chips when neither layer is set', () => {
      const { queryByText } = render(<Instructions instructions={dual()} />)
      expect(queryByText('Global on')).toBeNull()
      expect(queryByText('Personal on')).toBeNull()
      expect(queryByText('Global muted')).toBeNull()
      expect(queryByText('Personal muted')).toBeNull()
    })
  })

  describe('global section', () => {
    it('admin: Save commits the draft, not each keystroke, and only to global', async () => {
      const instructions = dual()
      const { getByLabelText, getAllByText } = render(
        <Instructions instructions={instructions} />,
      )
      expandStrip(getByLabelText)
      fireEvent.change(getByLabelText(GLOBAL_FIELD), {
        target: { value: 'Answer in French' },
      })
      expect(instructions.global.setText).not.toHaveBeenCalled()
      await act(async () => {
        fireEvent.click(getAllByText('Save')[0])
      })
      expect(instructions.global.setText).toHaveBeenCalledWith('Answer in French')
      expect(instructions.personal.setText).not.toHaveBeenCalled()
    })

    it('admin: the switch mutes and Clear erases, leaving personal alone', async () => {
      const instructions = dual({ text: 'Be terse' }, { text: 'Prefer Parquet' })
      const { container, getByLabelText, getAllByText } = render(
        <Instructions instructions={instructions} />,
      )
      expandStrip(getByLabelText)
      await act(async () => {
        fireEvent.click(container.querySelectorAll('input[type="checkbox"]')[0])
      })
      expect(instructions.global.setEnabled).toHaveBeenCalledWith(false)
      await act(async () => {
        fireEvent.click(getAllByText('Clear')[0])
      })
      expect(instructions.global.clear).toHaveBeenCalled()
      expect(instructions.personal.clear).not.toHaveBeenCalled()
      expect(instructions.personal.setEnabled).not.toHaveBeenCalled()
    })

    it('admin: a conflicting write surfaces its message', async () => {
      const instructions = dual({
        setText: vi.fn(async () => {
          throw new SettingsConflictError()
        }),
      })
      const { getByLabelText, getAllByText, getByRole } = render(
        <Instructions instructions={instructions} />,
      )
      expandStrip(getByLabelText)
      fireEvent.change(getByLabelText(GLOBAL_FIELD), { target: { value: 'x' } })
      await act(async () => {
        fireEvent.click(getAllByText('Save')[0])
      })
      expect(getByRole('alert').textContent).toContain('changed by someone else')
    })

    it('non-admin: read-only global text, no global controls', () => {
      const { getByLabelText, getByText, queryByLabelText, getAllByText } = render(
        <Instructions instructions={dual({ text: 'Be terse', canEdit: false })} />,
      )
      expandStrip(getByLabelText)
      expect(getByText('Be terse')).toBeTruthy()
      expect(queryByLabelText(GLOBAL_FIELD)).toBeNull()
      // the only Save/Clear left belong to the personal section
      expect(getAllByText('Save')).toHaveLength(1)
      expect(getAllByText('Clear')).toHaveLength(1)
    })

    it('non-admin: says so when the stack has no global instructions', () => {
      const { getByLabelText, getByText } = render(
        <Instructions instructions={dual({ canEdit: false })} />,
      )
      expandStrip(getByLabelText)
      expect(getByText('No global instructions set for this stack.')).toBeTruthy()
    })
  })

  describe('personal section', () => {
    it('is editable for a non-admin, independent of the global layer', async () => {
      const instructions = dual({ text: 'Be terse', canEdit: false })
      const { getByLabelText, getByText } = render(
        <Instructions instructions={instructions} />,
      )
      expandStrip(getByLabelText)
      fireEvent.change(getByLabelText(PERSONAL_FIELD), {
        target: { value: 'Prefer Parquet' },
      })
      await act(async () => {
        fireEvent.click(getByText('Save'))
      })
      expect(instructions.personal.setText).toHaveBeenCalledWith('Prefer Parquet')
      expect(instructions.global.setText).not.toHaveBeenCalled()
    })

    it('clearing personal notes does not touch global', async () => {
      const instructions = dual(
        { text: 'Be terse', canEdit: false },
        { text: 'Prefer Parquet' },
      )
      const { getByLabelText, getByText } = render(
        <Instructions instructions={instructions} />,
      )
      expandStrip(getByLabelText)
      await act(async () => {
        fireEvent.click(getByText('Clear'))
      })
      expect(instructions.personal.clear).toHaveBeenCalled()
      expect(instructions.global.clear).not.toHaveBeenCalled()
    })

    it('muting personal notes does not touch global', async () => {
      const instructions = dual(
        { text: 'Be terse', canEdit: false },
        { text: 'Prefer Parquet' },
      )
      const { container, getByLabelText } = render(
        <Instructions instructions={instructions} />,
      )
      expandStrip(getByLabelText)
      const switches = container.querySelectorAll('input[type="checkbox"]')
      expect(switches).toHaveLength(1)
      await act(async () => {
        fireEvent.click(switches[0])
      })
      expect(instructions.personal.setEnabled).toHaveBeenCalledWith(false)
      expect(instructions.global.setEnabled).not.toHaveBeenCalled()
    })

    it('both fields are present and separately addressable for an admin', () => {
      const { getByLabelText } = render(
        <Instructions
          instructions={dual({ text: 'Be terse' }, { text: 'Prefer Parquet' })}
        />,
      )
      expandStrip(getByLabelText)
      expect((getByLabelText(GLOBAL_FIELD) as HTMLTextAreaElement).value).toBe('Be terse')
      expect((getByLabelText(PERSONAL_FIELD) as HTMLTextAreaElement).value).toBe(
        'Prefer Parquet',
      )
    })
  })
})
