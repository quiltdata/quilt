import * as React from 'react'
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest'
import { ThemeProvider, createMuiTheme } from '@material-ui/core/styles'
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react'

const mocks = vi.hoisted(() => {
  class HTTPError extends Error {
    status: number

    json: { message: string }

    constructor(status: number, message: string) {
      super(message)
      this.status = status
      this.json = { message }
    }
  }
  return { HTTPError, req: vi.fn() }
})

vi.mock('utils/APIConnector', () => ({
  use: () => mocks.req,
  HTTPError: mocks.HTTPError,
}))

vi.mock('@sentry/react', () => ({ captureException: vi.fn() }))

import SupportDiagnostics from './SupportDiagnostics'

const theme = createMuiTheme()

function renderComponent() {
  return render(
    <ThemeProvider theme={theme}>
      <SupportDiagnostics />
    </ThemeProvider>,
  )
}

function archive(headers: Record<string, string>) {
  return new Response(new Blob(['PK\x03\x04'], { type: 'application/zip' }), { headers })
}

describe('containers/Admin/Settings/SupportDiagnostics', () => {
  let downloaded: { name: string } | null = null

  beforeEach(() => {
    downloaded = null
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:bundle')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(
      function click(this: HTMLAnchorElement) {
        downloaded = { name: this.download }
      },
    )
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
    mocks.req.mockReset()
  })

  it('downloads the bundle under the name the registry gave it', async () => {
    mocks.req.mockResolvedValue(
      archive({
        'Content-Disposition':
          'attachment; filename="quilt-support-diagnostics-run-1.zip"',
      }),
    )
    const { getByText } = renderComponent()

    fireEvent.click(getByText('Collect diagnostics'))

    await waitFor(() => expect(downloaded).not.toBeNull())
    expect(downloaded!.name).toBe('quilt-support-diagnostics-run-1.zip')
    expect(mocks.req).toHaveBeenCalledWith({
      endpoint: '/admin/support-diagnostics',
      method: 'POST',
      json: false,
    })
  })

  it('falls back to a generic name when the filename header is not exposed', async () => {
    mocks.req.mockResolvedValue(archive({}))
    const { getByText } = renderComponent()

    fireEvent.click(getByText('Collect diagnostics'))

    await waitFor(() => expect(downloaded).not.toBeNull())
    expect(downloaded!.name).toBe('quilt-support-diagnostics.zip')
  })

  it('reports a stack without the collector as information, not as a failure', async () => {
    mocks.req.mockRejectedValue(
      new mocks.HTTPError(
        503,
        'Support diagnostics collection is not available on this stack.',
      ),
    )
    const { container, getByText } = renderComponent()

    fireEvent.click(getByText('Collect diagnostics'))

    await waitFor(() => expect(getByText(/not available on this stack/)).toBeTruthy())
    expect(container.querySelector('.MuiAlert-standardInfo')).not.toBeNull()
    expect(container.querySelector('.MuiAlert-standardError')).toBeNull()
  })

  it('surfaces an unexpected failure as an error', async () => {
    mocks.req.mockRejectedValue(
      new mocks.HTTPError(502, 'The diagnostics collector failed.'),
    )
    const { container, getByText } = renderComponent()

    fireEvent.click(getByText('Collect diagnostics'))

    await waitFor(() => expect(getByText(/collector failed/)).toBeTruthy())
    expect(container.querySelector('.MuiAlert-standardError')).not.toBeNull()
  })
})
