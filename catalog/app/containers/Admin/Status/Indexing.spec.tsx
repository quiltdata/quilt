import * as React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { ThemeProvider, createMuiTheme } from '@material-ui/core/styles'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

const mocks = vi.hoisted(() => ({ req: vi.fn() }))

vi.mock('utils/APIConnector', () => ({ use: () => mocks.req }))
// The panel only reads bucketConfigs to gate the empty-search warning; every
// job here is ignore_dirs, which that gate skips before consulting shard depth.
vi.mock('utils/GraphQL', () => ({
  useQuery: () => ({ data: { bucketConfigs: [] }, fetching: false }),
}))

import Indexing from './Indexing'

const theme = createMuiTheme()

type JobOverrides = { retries_remaining?: number; id?: number }

const job = ({ id = 1, retries_remaining = 3 }: JobOverrides = {}) => ({
  id,
  name: 'bucket-a',
  prefix: '',
  ignore_dirs: true,
  retries_remaining,
  time_created: new Date().toISOString(),
  next_key_marker: null,
})

function renderPanel(results: ReturnType<typeof job>[]) {
  mocks.req.mockReset()
  mocks.req.mockResolvedValue({ results })
  return render(
    <ThemeProvider theme={theme}>
      <Indexing />
    </ThemeProvider>,
  )
}

const strip = (c: HTMLElement) => c.querySelector('.MuiLinearProgress-root')

describe('containers/Admin/Status/Indexing', () => {
  it('reports outstanding work without claiming how far it got', async () => {
    const { container } = renderPanel([job()])

    await waitFor(() => expect(strip(container)).not.toBeNull())

    const bar = strip(container)!
    // The registry exposes an opaque resume cursor and no denominator, so any
    // determinate value here would be invented. Both halves matter: the bar must
    // stay indeterminate AND must not report a position to assistive tech.
    expect(bar.className).toContain('MuiLinearProgress-indeterminate')
    expect(bar.getAttribute('aria-valuenow')).toBeNull()
    // State never rests on motion alone — the count is also written out.
    expect(screen.getByText(/1 job queued/)).toBeTruthy()
    expect(screen.queryByText(/%/)).toBeNull()
    // The payload has no checked-out field, so the panel must not claim a
    // worker is running.
    expect(screen.queryByText(/in flight|scanning/i)).toBeNull()
  })

  it('pluralizes the queued count', async () => {
    renderPanel([job({ id: 1 }), job({ id: 2 })])
    await waitFor(() => expect(screen.getByText(/2 jobs queued/)).toBeTruthy())
  })

  it('shows no activity for a queue of exhausted jobs', async () => {
    const { container } = renderPanel([job({ retries_remaining: 0 })])

    await waitFor(() => expect(screen.getByText('No jobs outstanding')).toBeTruthy())
    // An exhausted job is not progressing; a strip here would assert motion
    // that has stopped.
    expect(strip(container)).toBeNull()
  })

  it('tells an admin where to start a scan when none are queued', async () => {
    renderPanel([])
    await waitFor(() => expect(screen.getByText(/No scanner jobs queued/)).toBeTruthy())
  })

  it('stands down the liveness claim when a poll fails', async () => {
    mocks.req.mockReset()
    mocks.req.mockResolvedValueOnce({ results: [job()] })
    const { container } = render(
      <ThemeProvider theme={theme}>
        <Indexing />
      </ThemeProvider>,
    )
    await waitFor(() => expect(strip(container)).not.toBeNull())

    // Stale jobs survive a failed poll, so without gating on `error` the strip
    // would keep animating over data that is minutes old.
    mocks.req.mockRejectedValue(new Error('registry down'))
    fireEvent.click(screen.getByRole('button', { name: /refresh/i }))

    await waitFor(() =>
      expect(screen.getByText(/Could not load scanner jobs/)).toBeTruthy(),
    )
    expect(strip(container)).toBeNull()
    expect(screen.queryByText(/job queued/)).toBeNull()
  })
})
