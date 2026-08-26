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

    it('carries the reason to keyboard and screen-reader users', async () => {
      // The switch is disabled, so it is out of the tab order and fires no
      // events: without a focusable, named wrapper the reason is mouse-only.
      render(
        <EditableSwitch
          hint="Deactivated users can't sign in"
          disabled
          disabledReason="This service user is managed by the stack"
          checked
          onChange={vi.fn()}
        />,
      )
      const wrapper = screen.getByLabelText('This service user is managed by the stack')
      expect(wrapper.getAttribute('tabindex')).toBe('0')

      fireEvent.focus(wrapper)
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

    it('stays editable for an ordinary user', () => {
      const { container } = renderSwitch({
        name: 'u',
        isAdmin: false,
        isAdminAssignmentDisabled: false,
        isService: false,
      })
      expect(container.querySelector('input')?.disabled).toBe(false)
    })
  })

  describe('the Enabled column switch', () => {
    afterEach(cleanup)

    const column = columns.find((c) => c.id === 'isActive')!

    function renderSwitch(user: object, isSelf = false) {
      return render(
        <>
          {column.getDisplay!(
            undefined,
            user as never,
            {
              isSelf,
              setActive: vi.fn(),
            } as never,
          )}
        </>,
      )
    }

    it.each([
      [
        'a service user',
        { isService: true },
        false,
        'This service user is managed by the stack',
      ],
      ['yourself', { isService: false }, true, 'You cannot deactivate your own account'],
    ])('says why it is disabled for %s', async (_label, user, isSelf, reason) => {
      const { container } = renderSwitch({ name: 'u', isActive: true, ...user }, isSelf)
      expect(container.querySelector('input')?.disabled).toBe(true)
      fireEvent.mouseOver(container.querySelector('span')!)
      expect(await screen.findByText(reason)).toBeDefined()
    })

    it('stays editable for an ordinary user', () => {
      const { container } = renderSwitch({ name: 'u', isActive: true, isService: false })
      expect(container.querySelector('input')?.disabled).toBe(false)
    })
  })

  describe('the Role column', () => {
    afterEach(cleanup)

    const column = columns.find((c) => c.id === 'role')!

    function renderRole(user: object) {
      return render(
        <>
          {column.getDisplay!(
            undefined,
            { extraRoles: [], ...user } as never,
            {
              roles: [],
              defaultRole: null,
              openDialog: vi.fn(),
            } as never,
          )}
        </>,
      )
    }

    // The dialog this opens is read-only for both flags, so the invitation to
    // edit must be gated on the same pair.
    it.each([
      ['an SSO-managed user', { isRoleAssignmentDisabled: true, isService: false }],
      ['a service user', { isRoleAssignmentDisabled: false, isService: true }],
    ])('offers only viewing for %s', (_label, user) => {
      const { container } = renderRole(user)
      expect(container.querySelector('[title]')?.getAttribute('title')).toBe(
        'Click to view',
      )
    })

    it('offers editing for an ordinary user', () => {
      const { container } = renderRole({
        isRoleAssignmentDisabled: false,
        isService: false,
      })
      expect(container.querySelector('[title]')?.getAttribute('title')).toBe(
        'Click to edit',
      )
    })
  })
})
