import * as React from 'react'
import { render, cleanup, fireEvent, screen } from '@testing-library/react'
import { describe, it, expect, vi, afterEach } from 'vitest'

import { EditableSwitch } from './Users'

vi.mock('constants/config', () => ({ default: {} }))

describe('containers/Admin/UsersAndRoles/Users', () => {
  describe('EditableSwitch', () => {
    afterEach(cleanup)

    it('explains why it is disabled', async () => {
      // A dead control with no cause is indistinguishable from a rendering
      // bug -- and two causes (self, service user) share this column.
      const { container } = render(
        <EditableSwitch
          hint="Deactivated users can't sign in"
          disabled
          disabledReason="This service user is managed by the stack"
          checked
          onChange={vi.fn()}
        />,
      )
      expect(container.querySelector('input')?.disabled).toBe(true)
      fireEvent.mouseOver(container.querySelector('span')!)
      expect(
        await screen.findByText('This service user is managed by the stack'),
      ).toBeDefined()
    })

    it('keeps the hint on the enabled control', async () => {
      const { container } = render(
        <EditableSwitch
          hint="Deactivated users can't sign in"
          checked
          onChange={vi.fn()}
        />,
      )
      // MUI seeds the tooltip as a `title` before opening the popper; hover the
      // node that actually carries it.
      const titled = container.querySelector('[title]')!
      expect(titled.getAttribute('title')).toBe("Deactivated users can't sign in")
      fireEvent.mouseOver(titled)
      expect(await screen.findByText("Deactivated users can't sign in")).toBeDefined()
    })

    it('renders a plain disabled switch when no reason is given', () => {
      const { container } = render(
        <EditableSwitch
          hint="Deactivated users can't sign in"
          disabled
          checked
          onChange={vi.fn()}
        />,
      )
      expect(container.querySelector('input')?.disabled).toBe(true)
    })
  })
})
