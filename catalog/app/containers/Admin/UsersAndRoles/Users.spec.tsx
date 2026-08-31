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
      // ARIA gives a bare span no name; the role is what makes `aria-label` count.
      expect(wrapper.getAttribute('role')).toBe('group')
      expect(wrapper.getAttribute('title')).toBeNull()

      // Real focus, not a synthetic focus event: MUI opens on focus only when it
      // reads the focus as keyboard-driven, and a dispatched event moves nothing.
      fireEvent.keyDown(document.body, { key: 'Tab' })
      wrapper.focus()
      expect(document.activeElement).toBe(wrapper)
      expect(
        await screen.findByText('This service user is managed by the stack'),
      ).toBeDefined()
    })

    it('draws a focus ring on the reason carrier', () => {
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
      const sheets = [...document.querySelectorAll('style')].map(
        (el) => el.textContent ?? '',
      )
      const rules = sheets
        .join('\n')
        .split('}')
        .filter((r) =>
          [...wrapper.classList].some((c) => r.includes(`.${c}:focus-visible`)),
        )
      expect(rules.length).toBeGreaterThan(0)
      expect(rules.join('\n')).toMatch(/outline:\s*2px solid/)
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
})
