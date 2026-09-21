import * as React from 'react'
import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import * as UserInstructions from '../../Model/UserInstructions'

import Instructions from './Instructions'

// Integration of the strip with the real persistence hook: what the user
// types in the strip is what localStorage carries, and the amber
// "Instructions on" readout tracks the active state.

function Harness() {
  const instructions = UserInstructions.useUserInstructions()
  return <Instructions instructions={instructions} />
}

const expandStrip = (getByLabelText: (label: string) => HTMLElement) =>
  fireEvent.click(getByLabelText('Expand Qurator instructions'))

describe('components/Assistant/UI/Chat/Instructions', () => {
  afterEach(() => {
    cleanup()
    window.localStorage.clear()
  })

  it('starts collapsed with the editor hidden', () => {
    const { getByLabelText, queryByLabelText } = render(<Harness />)
    expect(getByLabelText('Expand Qurator instructions')).toBeTruthy()
    // Collapse keeps children mounted but hidden; the header advertises state
    expect(
      getByLabelText('Expand Qurator instructions').getAttribute('aria-expanded'),
    ).toBe('false')
    expect(queryByLabelText('Collapse Qurator instructions')).toBeNull()
  })

  it('persists typed instructions and shows the "Instructions on" chip', () => {
    const { getByLabelText, getByText } = render(<Harness />)
    expandStrip(getByLabelText)
    fireEvent.change(getByLabelText('Qurator instructions'), {
      target: { value: 'Answer in French' },
    })
    expect(window.localStorage.getItem(UserInstructions.STORAGE_KEY)).toBe(
      'Answer in French',
    )
    expect(getByText('Instructions on')).toBeTruthy()
  })

  it('rehydrates persisted instructions on mount', () => {
    window.localStorage.setItem(UserInstructions.STORAGE_KEY, 'Be terse')
    const { getByLabelText, getByText } = render(<Harness />)
    expect(getByText('Instructions on')).toBeTruthy()
    expandStrip(getByLabelText)
    expect((getByLabelText('Qurator instructions') as HTMLTextAreaElement).value).toBe(
      'Be terse',
    )
  })

  it('clears the stored instructions', () => {
    window.localStorage.setItem(UserInstructions.STORAGE_KEY, 'Be terse')
    const { getByLabelText, getByText, queryByText } = render(<Harness />)
    expandStrip(getByLabelText)
    fireEvent.click(getByText('Clear'))
    expect(window.localStorage.getItem(UserInstructions.STORAGE_KEY)).toBeNull()
    expect(queryByText('Instructions on')).toBeNull()
  })

  it('muting keeps the text but swaps the chip to "Muted"', () => {
    window.localStorage.setItem(UserInstructions.STORAGE_KEY, 'Be terse')
    const { container, getByLabelText, getByText, queryByText } = render(<Harness />)
    expandStrip(getByLabelText)
    const toggle = container.querySelector('input[type="checkbox"]')
    expect(toggle).toBeTruthy()
    fireEvent.click(toggle!)
    expect(window.localStorage.getItem(UserInstructions.ENABLED_STORAGE_KEY)).toBe('0')
    expect(window.localStorage.getItem(UserInstructions.STORAGE_KEY)).toBe('Be terse')
    expect(queryByText('Instructions on')).toBeNull()
    expect(getByText('Muted')).toBeTruthy()
  })
})
