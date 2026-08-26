import * as React from 'react'
import * as M from '@material-ui/core'
import { render, act, cleanup } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import * as style from 'constants/style'

// Layout's import graph reaches utils/AWS/Athena -> constants/config, which
// asserts on a window global that doesn't exist under vitest.
vi.mock('constants/config', () => ({ default: {}, registryUrl: '' }))

// The viewport is the input under test, and jsdom ships no matchMedia (MUI's
// useMediaQuery then reports false for everything), so drive it directly. Same
// idiom as Search/Sort.spec.tsx, but mutable: this spec needs both answers.
const { media } = vi.hoisted(() => ({ media: { narrow: false } }))

vi.mock('@material-ui/core', async () => ({
  ...(await vi.importActual('@material-ui/core')),
  useMediaQuery: () => media.narrow,
}))

// Both children are stubbed to record what the shell handed them. The claim here
// is the wiring -- which mode the shell picked and whether it offered a way into
// the rail -- and the children's own contracts are covered by their own specs
// (ContentBar.spec.tsx names the menu button; the rail's rows are unchanged
// between modes by construction, since both render the same markup).
const { sidebarProps, contentBarProps } = vi.hoisted(() => ({
  sidebarProps: [] as Record<string, unknown>[],
  contentBarProps: [] as Record<string, unknown>[],
}))

vi.mock('containers/Sidebar', () => ({
  Sidebar: (props: Record<string, unknown>) => {
    sidebarProps.push(props)
    return <nav data-testid="rail" />
  },
}))

vi.mock('./ContentBar', () => ({
  ContentBar: (props: Record<string, unknown>) => {
    contentBarProps.push(props)
    return <div data-testid="bar" />
  },
}))

// Stood in rather than rendered: the `bare` claim below is about what the shell
// does NOT mount, which is unaffected by this header's own internals -- and the
// real one needs router and named-route providers that have no bearing on it.
vi.mock('./BareHeader', () => ({ default: () => <header data-testid="bare-header" /> }))

import { Layout } from './Layout'

const last = (calls: Record<string, unknown>[]) => calls[calls.length - 1]

// The app theme, as app.tsx provides it: BareHeader (mounted by `bare` pages)
// reads the palette.navigation extension, which the stock theme lacks.
const renderShell = (ui: React.ReactElement) =>
  render(<M.MuiThemeProvider theme={style.appTheme}>{ui}</M.MuiThemeProvider>)

describe('components/Layout/Layout (shell adaptation)', () => {
  afterEach(() => {
    cleanup()
    sidebarProps.length = 0
    contentBarProps.length = 0
    media.narrow = false
  })

  // Wide: the rail is a permanent 256px column, so a menu button would toggle
  // something already on screen.
  it('keeps the rail permanent and offers no menu button on a wide viewport', () => {
    renderShell(<Layout>content</Layout>)
    expect(last(sidebarProps).compact).toBe(false)
    expect(last(contentBarProps).onMenu).toBeUndefined()
  })

  // Narrow: there is no room for a 256px column beside the content, so the rail
  // becomes an overlay -- and then the header button is the only way to reach it.
  // Handing the rail `compact` without handing the bar an `onMenu` would strand
  // navigation entirely, which is why both are asserted together.
  it('switches the rail to an overlay and offers a menu button when narrow', () => {
    media.narrow = true
    renderShell(<Layout>content</Layout>)
    expect(last(sidebarProps).compact).toBe(true)
    expect(last(sidebarProps).open).toBe(false)
    expect(typeof last(sidebarProps).onClose).toBe('function')
    expect(typeof last(contentBarProps).onMenu).toBe('function')
  })

  it('opens the overlay when the header button asks, and can close it again', () => {
    media.narrow = true
    renderShell(<Layout>content</Layout>)
    const onMenu = last(contentBarProps).onMenu as () => void
    act(() => onMenu())
    expect(last(sidebarProps).open).toBe(true)
    // The rail closes itself on navigation via this same handle, so it has to
    // actually clear the state rather than only exist.
    const onClose = last(sidebarProps).onClose as () => void
    act(() => onClose())
    expect(last(sidebarProps).open).toBe(false)
  })

  // `bare` pages (sign-in) mount neither the rail nor the header band, so the
  // compact switch must not conjure either one.
  it('leaves bare pages alone in both modes', () => {
    media.narrow = true
    renderShell(<Layout bare>content</Layout>)
    expect(sidebarProps).toHaveLength(0)
    expect(contentBarProps).toHaveLength(0)
  })
})
