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

type JobOverrides = {
  retries_remaining?: number
  id?: number
  next_key_marker?: string | null
}

const job = ({
  id = 1,
  retries_remaining = 3,
  next_key_marker = null,
}: JobOverrides = {}) => ({
  id,
  name: 'bucket-a',
  prefix: '',
  ignore_dirs: true,
  retries_remaining,
  time_created: new Date().toISOString(),
  next_key_marker,
})

const strip = (c: HTMLElement) => c.querySelector('.MuiLinearProgress-root')

function renderPanel() {
  return render(
    <ThemeProvider theme={theme}>
      <Indexing />
    </ThemeProvider>,
  )
}

// One Refresh click is one more poll, which is what gives the panel a second
// cursor reading to compare against.
async function poll() {
  fireEvent.click(screen.getByRole('button', { name: /refresh/i }))
}

describe('containers/Admin/Status/Indexing', () => {
  it('waits for a second reading before claiming a job is advancing', async () => {
    mocks.req.mockReset()
    mocks.req.mockResolvedValue({ results: [job({ next_key_marker: 'a/1' })] })
    const { container } = renderPanel()

    // The first response is a baseline, not evidence: one cursor value cannot
    // show movement, so the strip must stay off.
    await waitFor(() => expect(screen.getByText(/1 job queued/)).toBeTruthy())
    expect(screen.getByText(/no cursor movement observed yet/)).toBeTruthy()
    expect(strip(container)).toBeNull()
  })

  it('animates only once the cursor has actually moved', async () => {
    mocks.req.mockReset()
    mocks.req.mockResolvedValueOnce({ results: [job({ next_key_marker: 'a/1' })] })
    const { container } = renderPanel()
    await waitFor(() => expect(screen.getByText(/1 job queued/)).toBeTruthy())

    mocks.req.mockResolvedValue({ results: [job({ next_key_marker: 'b/2' })] })
    await poll()

    await waitFor(() => expect(strip(container)).not.toBeNull())
    expect(screen.getByText(/1 advancing/)).toBeTruthy()

    const bar = strip(container)!
    // No denominator exists, so the bar must stay indeterminate and must not
    // report a position to assistive tech.
    expect(bar.className).toContain('MuiLinearProgress-indeterminate')
    expect(bar.getAttribute('aria-valuenow')).toBeNull()
    expect(screen.queryByText(/%/)).toBeNull()
  })

  it('does not present a stalled job as live scanning', async () => {
    mocks.req.mockReset()
    // Attempts remaining but the cursor never moves: the exact case where
    // `retries_remaining > 0` alone would animate a scan that is going nowhere.
    mocks.req.mockResolvedValue({
      results: [job({ next_key_marker: 'stuck/here', retries_remaining: 2 })],
    })
    const { container } = renderPanel()
    await waitFor(() => expect(screen.getByText(/1 job queued/)).toBeTruthy())

    await poll()
    await poll()

    expect(strip(container)).toBeNull()
    expect(screen.getByText(/no cursor movement observed yet/)).toBeTruthy()
    expect(screen.queryByText(/\d+ advancing/)).toBeNull()
  })

  it('counts only the jobs whose cursors moved', async () => {
    mocks.req.mockReset()
    mocks.req.mockResolvedValueOnce({
      results: [
        job({ id: 1, next_key_marker: 'a/1' }),
        job({ id: 2, next_key_marker: 'x/1' }),
      ],
    })
    const { container } = renderPanel()
    await waitFor(() => expect(screen.getByText(/2 jobs queued/)).toBeTruthy())

    // Job 1 advances, job 2 is stuck on the same key.
    mocks.req.mockResolvedValue({
      results: [
        job({ id: 1, next_key_marker: 'a/2' }),
        job({ id: 2, next_key_marker: 'x/1' }),
      ],
    })
    await poll()

    await waitFor(() => expect(strip(container)).not.toBeNull())
    expect(screen.getByText(/2 jobs queued · 1 advancing/)).toBeTruthy()
  })

  it('shows no activity for a queue of exhausted jobs', async () => {
    mocks.req.mockReset()
    mocks.req.mockResolvedValue({ results: [job({ retries_remaining: 0 })] })
    const { container } = renderPanel()

    await waitFor(() => expect(screen.getByText('No jobs outstanding')).toBeTruthy())
    expect(strip(container)).toBeNull()
  })

  it('tells an admin where to start a scan when none are queued', async () => {
    mocks.req.mockReset()
    mocks.req.mockResolvedValue({ results: [] })
    renderPanel()
    await waitFor(() => expect(screen.getByText(/No scanner jobs queued/)).toBeTruthy())
  })

  it('stands down the liveness claim when a poll fails', async () => {
    mocks.req.mockReset()
    mocks.req.mockResolvedValueOnce({ results: [job({ next_key_marker: 'a/1' })] })
    const { container } = renderPanel()
    await waitFor(() => expect(screen.getByText(/1 job queued/)).toBeTruthy())

    mocks.req.mockResolvedValueOnce({ results: [job({ next_key_marker: 'b/2' })] })
    await poll()
    await waitFor(() => expect(strip(container)).not.toBeNull())

    // Stale jobs survive a failed poll, so without gating on `error` the strip
    // would keep animating over data that is minutes old.
    mocks.req.mockRejectedValue(new Error('registry down'))
    await poll()

    await waitFor(() =>
      expect(screen.getByText(/Could not load scanner jobs/)).toBeTruthy(),
    )
    expect(strip(container)).toBeNull()
    expect(screen.queryByText(/\d+ advancing/)).toBeNull()
  })
})
