import * as React from 'react'
import { MemoryRouter } from 'react-router-dom'
import * as M from '@material-ui/core'
import { render, cleanup, fireEvent, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import * as routes from 'constants/routes'
import * as style from 'constants/style'
import * as NamedRoutes from 'utils/NamedRoutes'

// The rail's data sources (auth, subscription, bookmarks, assistant, settings)
// are stood in with their quietest shapes: this spec is about the fold -- the
// toggle, the shortcut, what the compact overlay suppresses -- not about what
// the rows say.
vi.mock('constants/config', () => ({
  default: { mode: 'PRODUCT', stackVersion: '1.2.3' },
  registryUrl: '',
}))
vi.mock('components/Assistant', () => ({ Model: { useAssistantAPI: () => null } }))
vi.mock('components/Logo', () => ({
  default: ({ variant }: { variant?: string }) => <div data-testid={`logo-${variant}`} />,
}))
vi.mock('containers/Bookmarks', () => ({
  use: () => ({ show: () => {}, hasUpdates: false }),
  Drawer: () => null,
}))
vi.mock('containers/Notifications', () => ({ use: () => ({ push: () => {} }) }))
vi.mock('utils/CatalogSettings', () => ({ use: () => null }))
vi.mock('utils/clipboard', () => ({ default: () => {} }))
vi.mock('./AuthState', () => ({
  AuthState: {
    match: (cases: { Ready: (v: { user: null }) => unknown }) =>
      cases.Ready({ user: null }),
  },
  useAuthState: () => ({}),
}))
vi.mock('./RoleSwitcher', () => ({ default: () => () => {} }))
vi.mock('./Subscription', () => ({ useState: () => ({ invalid: false }) }))

import { Sidebar, type SidebarProps } from './Sidebar'
import { COLLAPSED_STORAGE_KEY } from './useCollapsed'

const { home, buckets, bucketRoot, search, queries, admin, signIn, signOut } = routes

const renderRail = (props: SidebarProps = {}) =>
  render(
    <M.MuiThemeProvider theme={style.appTheme}>
      <MemoryRouter initialEntries={['/buckets']}>
        <NamedRoutes.Provider
          routes={{ home, buckets, bucketRoot, search, queries, admin, signIn, signOut }}
        >
          <Sidebar {...props} />
        </NamedRoutes.Provider>
      </MemoryRouter>
    </M.MuiThemeProvider>,
  )

const rail = () => screen.getByRole('navigation')
const toggle = () => screen.getByRole('button', { name: /(collapse|expand) sidebar/i })

describe('containers/Sidebar/Sidebar (the fold)', () => {
  let store: Record<string, string>

  beforeEach(() => {
    store = {}
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: {
        clear: () => {
          store = {}
        },
        getItem: (key: string) => store[key] ?? null,
        setItem: (key: string, value: string) => {
          store[key] = value
        },
      },
    })
  })

  afterEach(() => {
    cleanup()
  })

  it('starts expanded and folds from the chevron, persisting the choice', () => {
    renderRail()
    const t = toggle()
    expect(t.getAttribute('aria-expanded')).toBe('true')
    expect(t.getAttribute('aria-controls')).toBe('sidebar-nav')
    const width = () => window.getComputedStyle(rail()).width

    expect(width()).toBe('256px')
    fireEvent.click(t)
    expect(width()).toBe('72px')
    expect(toggle().getAttribute('aria-expanded')).toBe('false')
    expect(toggle().getAttribute('aria-label')).toBe('Expand sidebar')
    expect(store[COLLAPSED_STORAGE_KEY]).toBe('1')
  })

  it('restores a folded rail from the stored preference', () => {
    store[COLLAPSED_STORAGE_KEY] = '1'
    renderRail()
    expect(window.getComputedStyle(rail()).width).toBe('72px')
  })

  // Collapsed rows keep their text (faded, under the clip) so nothing loses its
  // accessible name; the version readout is the one thing that leaves the tab
  // order, since it has no icon form.
  it('keeps every row named when folded and drops only the version readout', () => {
    store[COLLAPSED_STORAGE_KEY] = '1'
    renderRail()
    for (const name of ['Volumes', 'Search', 'Queries', 'Bookmarks', 'Sign in']) {
      expect(screen.getByRole(/button|link/, { name })).toBeTruthy()
    }
    const version = screen.getByTitle(/copy platform release version/i)
    expect(version.getAttribute('tabindex')).toBe('-1')
    expect(version.getAttribute('aria-hidden')).toBe('true')
  })

  it('toggles on `[` except while typing in a field', () => {
    renderRail()
    const width = () => window.getComputedStyle(rail()).width

    fireEvent.keyDown(window, { key: '[' })
    expect(width()).toBe('72px')
    fireEvent.keyDown(window, { key: '[' })
    expect(width()).toBe('256px')

    const input = document.createElement('input')
    document.body.appendChild(input)
    fireEvent.keyDown(input, { key: '[' })
    expect(width()).toBe('256px')
    input.remove()

    // A JsonEditor cell is a focusable div, and `[` there starts an array.
    const cell = document.createElement('div')
    cell.setAttribute('role', 'textbox')
    cell.tabIndex = 0
    document.body.appendChild(cell)
    fireEvent.keyDown(cell, { key: '[' })
    expect(width()).toBe('256px')
    cell.remove()

    // Cmd/Ctrl+[ is somebody else's shortcut; a held key must not strobe.
    fireEvent.keyDown(window, { key: '[', metaKey: true })
    fireEvent.keyDown(window, { key: '[', ctrlKey: true })
    fireEvent.keyDown(window, { key: '[', repeat: true })
    expect(width()).toBe('256px')

    // AltGr+8 (Windows: ctrl+alt) and Option+5 (macOS: alt) are how `[` is
    // typed on German, Nordic and Spanish layouts.
    fireEvent.keyDown(window, { key: '[', ctrlKey: true, altKey: true })
    expect(width()).toBe('72px')
    fireEvent.keyDown(window, { key: '[', altKey: true })
    expect(width()).toBe('256px')
  })

  // The overlay drawer has nothing beside it to make room for, so the compact
  // shell never offers the fold -- and a remembered preference must not leak
  // into it as a 72px overlay.
  it('never folds the compact overlay, even with a stored preference', () => {
    store[COLLAPSED_STORAGE_KEY] = '1'
    renderRail({ compact: true, open: true })
    expect(screen.queryByRole('button', { name: /sidebar/i })).toBeNull()
    expect(window.getComputedStyle(rail()).width).toBe('256px')
  })
})
