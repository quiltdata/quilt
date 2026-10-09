import * as React from 'react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { ThemeProvider, createMuiTheme } from '@material-ui/core/styles'
import { fireEvent, render, screen } from '@testing-library/react'

const mocks = vi.hoisted(() => ({
  result: {} as { data?: unknown; error?: Error; fetching?: boolean },
  saveAs: vi.fn(),
}))

vi.mock('utils/GraphQL', () => ({ useQuery: () => mocks.result }))
vi.mock('utils/saveAs', () => ({ default: mocks.saveAs }))
vi.mock('utils/NamedRoutes', () => ({
  use: () => ({ urls: { bucketFile: (b: string, k: string) => `/b/${b}/tree/${k}` } }),
}))
vi.mock('utils/MetaTitle', () => ({ default: () => null }))
vi.mock('constants/config', () => ({ default: { stackVersion: 'test' } }))

import GxP from './GxP'

const theme = createMuiTheme()

function renderPage(status: unknown, error?: Error) {
  mocks.result = status
    ? { data: { status }, fetching: false }
    : { error, fetching: false }
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

  it('keeps the catalogue and export when the status read fails', () => {
    renderPage(null, new Error('Throttled'))
    expect(screen.getByText(/Status could not be loaded \(Throttled\)/)).toBeTruthy()
    expect(screen.queryAllByText('Supported')).toHaveLength(0)
    expect(screen.getAllByText('Not verified')).toHaveLength(4)
    expect(screen.getByText('Export evidence').closest('button')!.disabled).toBe(false)
  })

  it('links the latest status report as the IQ snapshot', () => {
    renderPage({
      __typename: 'Status',
      canaries: [],
      latestStats: { passed: 0, failed: 0, running: 0 },
      reports: {
        total: 1,
        page: [
          {
            timestamp: new Date('2026-10-06T12:10:00Z'),
            renderedReportLocation: {
              bucket: 'reports',
              key: '2026/10/06/12-10-00.html',
            },
          },
        ],
      },
    })
    expect(screen.getByText(/Latest IQ snapshot 2026-10-06T12:10:00.000Z/)).toBeTruthy()
    expect(screen.getByText('view').getAttribute('href')).toBe(
      '/b/reports/tree/2026/10/06/12-10-00.html',
    )
  })

  it('exports evidence without GraphQL type names', async () => {
    mocks.saveAs.mockClear()
    renderPage({
      __typename: 'Status',
      canaries: [{ __typename: 'Canary', name: 'qxp-ctlg-uri', ok: true }],
      latestStats: { __typename: 'TestStats', passed: 1, failed: 0, running: 0 },
      reports: { total: 0, page: [] },
    })
    fireEvent.click(screen.getByText('Export evidence'))
    const [blob, filename] = mocks.saveAs.mock.calls[0]
    expect(filename).toMatch(/^gxp-evidence-\d{4}-\d{2}-\d{2}\.json$/)
    const text = await (blob as Blob).text()
    expect(text).not.toContain('__typename')
    const evidence = JSON.parse(text)
    expect(evidence.stackVersion).toBe('test')
    expect(evidence.statusMonitoring).toBe('on')
    expect(evidence.requirements.find((r: any) => r.id === 'OQ-2').liveCheck).toBe('pass')
  })
})
