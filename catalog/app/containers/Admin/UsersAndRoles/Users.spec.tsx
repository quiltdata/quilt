import * as React from 'react'
import { render, cleanup, fireEvent, screen } from '@testing-library/react'
import { describe, it, expect, vi, afterEach } from 'vitest'

import { EditableSwitch, columns } from './Users'

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

  describe('the Admin column switch', () => {
    afterEach(cleanup)

    const column = columns.find((c) => c.id === 'isAdmin')!

    function renderSwitch(user: object, isSelf = false) {
      return render(
        <>
          {column.getDisplay!(undefined, user as never, { isSelf, openDialog: vi.fn() })}
        </>,
      )
    }

    it.each([
      [
        'a service user',
        { isAdminAssignmentDisabled: true, isService: true },
        false,
        'This service user is managed by the stack',
      ],
      [
        'an SSO-managed user',
        { isAdminAssignmentDisabled: true, isService: false },
        false,
        'Admin capabilities for this user are managed by the SSO configuration',
      ],
      [
        'yourself',
        { isAdminAssignmentDisabled: false, isService: false },
        true,
        'You cannot change your own admin status',
      ],
    ])('says why it is disabled for %s', async (_label, user, isSelf, reason) => {
      const { container } = renderSwitch({ name: 'u', isAdmin: false, ...user }, isSelf)
      expect(container.querySelector('input')?.disabled).toBe(true)
      fireEvent.mouseOver(container.querySelector('span')!)
      expect(await screen.findByText(reason)).toBeDefined()
    })
  })
})
