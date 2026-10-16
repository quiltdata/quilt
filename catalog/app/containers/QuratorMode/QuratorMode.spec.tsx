import * as React from 'react'
import { MemoryRouter } from 'react-router-dom'
import * as M from '@material-ui/core'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import * as style from 'constants/style'

vi.mock('constants/config', () => ({ default: {}, registryUrl: '' }))

// jsdom has no matchMedia, so the shell's breakpoint is driven directly.
const { media, refs } = vi.hoisted(() => ({
  media: { single: false },
  refs: { list: [] as { kind: 'bucket'; bucket: string }[] },
}))

// The page's own claim is where the session pane goes; the chat and the shell
// have their own specs, so they stand in and only surface the header slot.
vi.mock('components/Layout', () => ({
  useCompactShell: () => media.single,
  default: ({ pre, children }: { pre?: React.ReactNode; children?: React.ReactNode }) => (
    <>
      {pre}
      {children}
    </>
  ),
}))

vi.mock('components/Assistant/UI/Chat', () => ({
  default: ({ headerActions }: { headerActions?: React.ReactNode }) => (
    <div data-testid="chat">{headerActions}</div>
  ),
}))

vi.mock('components/Assistant/UI/InlinePresence', () => ({
  Provide: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

vi.mock('components/Assistant/Model/SessionSave', () => ({
  useSessionSave: () => ({ status: { _tag: 'idle' } }),
}))

vi.mock('components/Assistant/Model/SessionPackage', async (importOriginal) => ({
  ...(await importOriginal<typeof import('components/Assistant/Model/SessionPackage')>()),
  references: () => refs.list,
}))

vi.mock('components/Assistant', () => ({
  Model: { useAssistantAPI: () => ({ state: { events: [] } }) },
}))

vi.mock('utils/NamedRoutes', () => ({
  use: () => ({
    urls: {
      home: () => '/',
      bucketOverview: (b: string) => `/b/${b}`,
      bucketFile: (b: string, k: string) => `/b/${b}/tree/${k}`,
      bucketPackageDetail: (b: string, n: string) => `/b/${b}/packages/${n}`,
      bucketPackageTree: (b: string, n: string) => `/b/${b}/packages/${n}/tree`,
    },
  }),
}))

import QuratorMode from './index'

// A fresh element each call: rerendering the same one would let React skip it.
const page = () => (
  <M.MuiThemeProvider theme={style.appTheme}>
    <MemoryRouter>
      <QuratorMode />
    </MemoryRouter>
  </M.MuiThemeProvider>
)

const renderPage = () => render(page())

describe('containers/QuratorMode', () => {
  afterEach(() => {
    cleanup()
    media.single = false
    refs.list = []
  })

  it('shows the session pane beside the chat on wide screens', () => {
    renderPage()
    expect(screen.getByLabelText('Session context')).toBeTruthy()
    expect(screen.getByText('Back to catalog view')).toBeTruthy()
    expect(screen.queryByLabelText(/^Session details/)).toBeNull()
  })

  it('keeps the pane behind a header button in single column', () => {
    media.single = true
    refs.list = [
      { kind: 'bucket', bucket: 'a' },
      { kind: 'bucket', bucket: 'b' },
    ]
    renderPage()
    expect(screen.queryByLabelText('Session context')).toBeNull()
    const button = screen.getByLabelText('Session details, 2 touched')
    expect(screen.getByTestId('chat').contains(button)).toBe(true)
    expect(button.textContent).toContain('2')
  })

  it('opens the pane as a sheet, without the redundant back button', async () => {
    media.single = true
    renderPage()
    fireEvent.click(screen.getByLabelText(/^Session details/))
    expect(screen.getByLabelText('Session context')).toBeTruthy()
    expect(screen.getByText('Touched in this session')).toBeTruthy()
    expect(screen.queryByText('Back to catalog view')).toBeNull()
    fireEvent.click(screen.getByLabelText('Close session details'))
    await waitFor(() => expect(screen.queryByLabelText('Session context')).toBeNull())
  })

  // A tablet rotated to wide and back must not find the sheet open by itself.
  it('does not reopen the sheet on a return to single column', async () => {
    media.single = true
    const { rerender } = renderPage()
    fireEvent.click(screen.getByLabelText(/^Session details/))
    const again = () => rerender(page())
    media.single = false
    again()
    media.single = true
    again()
    await waitFor(() => expect(screen.queryByLabelText('Session context')).toBeNull())
  })
})
