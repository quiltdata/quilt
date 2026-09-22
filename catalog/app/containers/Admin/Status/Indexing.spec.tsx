import * as React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { ThemeProvider, createMuiTheme } from '@material-ui/core/styles'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'

const mocks = vi.hoisted(() => ({ req: vi.fn() }))

vi.mock('utils/APIConnector', () => ({ use: () => mocks.req }))
// The panel only reads bucketConfigs to gate the empty-search warning; every
// job here is ignore_dirs, which that gate skips before consulting shard depth.
vi.mock('utils/GraphQL', () => ({
  useQuery: () => ({ data: { bucketConfigs: [] }, fetching: false }),
}))

import Indexing from './Indexing'

const POLL_MS = 10_000
const REQUEST_TIMEOUT_MS = 2 * POLL_MS

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
// cursor reading to compare against. The click only starts the request, so wait
// for it to be issued and let its resolution render: otherwise an assertion
// about unchanged state passes against whatever the previous poll left behind,
// proving nothing about the transition under test.
async function poll() {
  const before = mocks.req.mock.calls.length
  fireEvent.click(screen.getByRole('button', { name: /refresh/i }))
  await waitFor(() => expect(mocks.req.mock.calls.length).toBeGreaterThan(before))
  await act(async () => {})
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
    // The copy this panel shipped with called any unexhausted job "in flight".
    expect(screen.queryByText(/in flight|scanning/i)).toBeNull()
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
    expect(screen.queryByText(/job queued/)).toBeNull()
  })

  it('drops the liveness claim when the advancing job exhausts its retries', async () => {
    mocks.req.mockReset()
    mocks.req.mockResolvedValueOnce({
      results: [job({ next_key_marker: 'a/1', retries_remaining: 1 })],
    })
    const { container } = renderPanel()
    await waitFor(() => expect(screen.getByText(/1 job queued/)).toBeTruthy())

    // The cursor moved, but the job gave up on that same poll. The queue count
    // drops to zero, so the strip must not still be animating beside it.
    mocks.req.mockResolvedValue({
      results: [job({ next_key_marker: 'b/2', retries_remaining: 0 })],
    })
    await poll()

    await waitFor(() => expect(screen.getByText('No jobs outstanding')).toBeTruthy())
    expect(strip(container)).toBeNull()
  })

  it('gives up on a poll that never answers, instead of animating over it', async () => {
    vi.useFakeTimers()
    try {
      mocks.req.mockReset()
      mocks.req.mockResolvedValueOnce({ results: [job({ next_key_marker: 'a/1' })] })
      const { container } = renderPanel()
      await act(async () => {})

      mocks.req.mockResolvedValueOnce({ results: [job({ next_key_marker: 'b/2' })] })
      await act(async () => {
        await vi.advanceTimersByTimeAsync(POLL_MS)
      })
      expect(strip(container)).not.toBeNull()

      // Unbounded, this would freeze `jobs` at the last good reading: no
      // banner, rows ageing against a timestamp nobody re-fetched, and the
      // strip animating over all of it.
      mocks.req.mockReturnValue(new Promise(() => {}))
      await act(async () => {
        await vi.advanceTimersByTimeAsync(POLL_MS + REQUEST_TIMEOUT_MS)
      })

      expect(strip(container)).toBeNull()
      expect(screen.getByText(/Could not load scanner jobs/)).toBeTruthy()
    } finally {
      vi.useRealTimers()
    }
  })
})
