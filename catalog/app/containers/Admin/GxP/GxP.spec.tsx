import * as React from 'react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { ThemeProvider, createMuiTheme } from '@material-ui/core/styles'
import { render, screen } from '@testing-library/react'

const mocks = vi.hoisted(() => ({ status: null as unknown }))

vi.mock('utils/GraphQL', () => ({ useQueryS: () => ({ status: mocks.status }) }))
vi.mock('utils/NamedRoutes', () => ({
  use: () => ({ urls: { bucketFile: (b: string, k: string) => `/b/${b}/tree/${k}` } }),
}))
vi.mock('utils/MetaTitle', () => ({ default: () => null }))
vi.mock('constants/config', () => ({ default: { stackVersion: 'test' } }))

import GxP from './GxP'

const theme = createMuiTheme()

function renderPage(status: unknown) {
  mocks.status = status
  return render(
    <ThemeProvider theme={theme}>
      <MemoryRouter>
        <GxP />
      </MemoryRouter>
    </ThemeProvider>,
  )
}

describe('containers/Admin/GxP', () => {
  it('shows the catalogue without claiming canary-backed rows when monitoring is off', () => {
    renderPage({ __typename: 'Unavailable' })
    expect(screen.getByText(/is not enabled on this\s+stack/)).toBeTruthy()
    expect(screen.queryAllByText('Supported')).toHaveLength(0)
    expect(screen.getAllByText('Not enabled on this stack')).toHaveLength(4)
  })

  it('follows live canary state when monitoring is on', () => {
    renderPage({
      __typename: 'Status',
      canaries: [
        { name: 'qxp-ctlg-bucket-ac', ok: true },
        { name: 'qxp-ctlg-uri', ok: false },
        { name: 'qxp-ctlg-pkg-create', ok: true },
        { name: 'qxp-ctlg-search', ok: null },
      ],
      latestStats: { passed: 2, failed: 1, running: 1 },
      reports: { total: 0, page: [] },
    })
    expect(screen.queryByText(/is not enabled on this\s+stack/)).toBe(null)
    expect(screen.getByText('No report yet')).toBeTruthy()
    expect(screen.getByText('2 passing · 1 failing · 1 running')).toBeTruthy()
    expect(screen.getAllByText('Supported')).toHaveLength(4)
    expect(screen.getByText('Failing')).toBeTruthy()
  })
})
