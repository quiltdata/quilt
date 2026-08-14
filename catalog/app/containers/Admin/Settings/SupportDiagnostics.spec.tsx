import * as React from 'react'
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest'
import { ThemeProvider, createMuiTheme } from '@material-ui/core/styles'
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react'

const mocks = vi.hoisted(() => {
  class HTTPError extends Error {
    status: number

    json: { message: string; error_code?: string }

    // `json` is whatever the body parsed to; APIConnector falls back to
    // `{ message: <the raw text> }` for a body that is not JSON at all, which is
    // what an ALB or nginx error page arrives as.
    constructor(status: number, message: string, errorCode?: string) {
      super(message)
      this.status = status
      this.json = errorCode ? { message, error_code: errorCode } : { message }
    }
  }
  return { HTTPError, req: vi.fn(), captureException: vi.fn() }
})

vi.mock('utils/APIConnector', () => ({
  use: () => mocks.req,
  HTTPError: mocks.HTTPError,
}))

vi.mock('@sentry/react', () => ({ captureException: mocks.captureException }))

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
    mocks.captureException.mockReset()
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
        'NotAvailable',
      ),
    )
    const { container, getByText } = renderComponent()

    fireEvent.click(getByText('Collect diagnostics'))

    await waitFor(() => expect(getByText(/not available on this stack/)).toBeTruthy())
    expect(container.querySelector('.MuiAlert-standardInfo')).not.toBeNull()
    expect(container.querySelector('.MuiAlert-standardError')).toBeNull()
    // Every stack is in this state until the template ships, so paging us on it
    // would bury the failures worth looking at.
    expect(mocks.captureException).not.toHaveBeenCalled()
  })

  it('surfaces an unexpected failure as an error', async () => {
    mocks.req.mockRejectedValue(
      new mocks.HTTPError(502, 'The diagnostics collector failed.', 'CollectorFailed'),
    )
    const { container, getByText } = renderComponent()

    fireEvent.click(getByText('Collect diagnostics'))

    await waitFor(() => expect(getByText(/collector failed/)).toBeTruthy())
    expect(container.querySelector('.MuiAlert-standardError')).not.toBeNull()
  })

  it('does not dress an infrastructure failure up as an expected one', async () => {
    // The registry cycling, or an ALB with no healthy target, answers 503 too --
    // with an HTML body and no error_code. Keying severity on the status alone
    // would paint that the same calm blue as "this stack has no collector".
    // Severity reads the code and never the status, so this covers every
    // code-less failure alike, 404 from a registry predating the route included.
    mocks.req.mockRejectedValue(
      new mocks.HTTPError(
        503,
        '<html><body><h1>503 Service Unavailable</h1></body></html>',
      ),
    )
    const { container, getByText } = renderComponent()

    fireEvent.click(getByText('Collect diagnostics'))

    await waitFor(() =>
      expect(container.querySelector('.MuiAlert-standardError')).not.toBeNull(),
    )
    expect(container.querySelector('.MuiAlert-standardInfo')).toBeNull()
    // And the page itself never reaches the admin.
    expect(getByText(/registry may be restarting/)).toBeTruthy()
    expect(container.textContent).not.toContain('<html>')
  })

  it('still downloads after the admin leaves the page, without touching state', async () => {
    // The saga owns the request, so navigating away does not cancel it: the bundle has
    // already cost a collection against a possibly-struggling cluster, and discarding
    // it would make the admin pay twice. State updates are the only thing skipped —
    // React 17 warns on setState after unmount.
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    let settle: (r: Response) => void = () => {}
    mocks.req.mockReturnValue(new Promise<Response>((r) => (settle = r)))
    const { getByText, unmount } = renderComponent()

    fireEvent.click(getByText('Collect diagnostics'))
    unmount()
    settle(archive({}))

    await waitFor(() => expect(downloaded).not.toBeNull())
    expect(consoleError).not.toHaveBeenCalled()
  })

  it('reports a failure that is not an HTTP error at all, and tells Sentry', async () => {
    // A download that dies mid-body rejects in response.blob(), not in the request,
    // so it never becomes an HTTPError. The button has to stop spinning and say
    // something, and this is the only failure Sentry ever hears about.
    mocks.req.mockRejectedValue(new TypeError('Failed to fetch'))
    const { container, getByText } = renderComponent()

    fireEvent.click(getByText('Collect diagnostics'))

    await waitFor(() => expect(getByText(/Could not collect diagnostics/)).toBeTruthy())
    expect(container.querySelector('.MuiAlert-standardError')).not.toBeNull()
    expect(mocks.captureException).toHaveBeenCalled()
  })
})
