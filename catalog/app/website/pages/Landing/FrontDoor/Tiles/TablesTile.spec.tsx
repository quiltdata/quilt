import * as React from 'react'
import { MemoryRouter } from 'react-router-dom'
import { render, cleanup, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('constants/config', () => ({ default: {} }))

const useRelevantBuckets = vi.hoisted(() => vi.fn(() => [] as { name: string }[]))
vi.mock('utils/Buckets', () => ({ useRelevantBuckets }))

// Per-bucket query result keyed by the `bucket` variable.
const tablesByBucket = vi.hoisted(() => ({
  current: {} as Record<string, string[] | null>,
}))
const useQuery = vi.hoisted(() =>
  vi.fn((_query: unknown, variables: { bucket: string }) => {
    const tables = tablesByBucket.current[variables.bucket]
    if (tables === undefined) return { fetching: true, data: undefined }
    if (tables === null) return { fetching: false, data: { bucketConfig: null } }
    return {
      fetching: false,
      data: {
        bucketConfig: {
          name: variables.bucket,
          tabulatorTables: tables.map((name) => ({ name })),
        },
      },
    }
  }),
)
vi.mock('utils/GraphQL', () => ({ useQuery }))

import TablesTile, { tableHref } from './TablesTile'

const renderTile = () =>
  render(
    <MemoryRouter>
      <TablesTile />
    </MemoryRouter>,
  )

describe('website/pages/Landing/FrontDoor/Tiles/TablesTile', () => {
  afterEach(() => {
    cleanup()
    useRelevantBuckets.mockReset()
    useRelevantBuckets.mockReturnValue([])
    tablesByBucket.current = {}
    useQuery.mockClear()
  })

  it('builds a bucket-scoped Athena deep link with ?table=', () => {
    expect(tableHref('quilt-drugbanks', 'my table')).toBe(
      '/b/quilt-drugbanks/queries/athena?table=my%20table',
    )
  })

  it('shows a loading state while probes are in flight', () => {
    useRelevantBuckets.mockReturnValue([{ name: 'b1' }])
    const { getByText } = renderTile()
    expect(getByText('Loading tables…')).toBeTruthy()
  })

  it('shows an empty state when no probed bucket has tables', async () => {
    useRelevantBuckets.mockReturnValue([{ name: 'b1' }, { name: 'b2' }])
    tablesByBucket.current = { b1: [], b2: null }
    const { getByText } = renderTile()
    await waitFor(() => expect(getByText('No tables in your top buckets')).toBeTruthy())
  })

  it('renders real table rows from one bucket with tables', async () => {
    useRelevantBuckets.mockReturnValue([{ name: 'b1' }])
    tablesByBucket.current = { b1: ['ccle', 'depmap'] }
    const { getByText } = renderTile()
    await waitFor(() => expect(getByText('ccle')).toBeTruthy())
    expect(getByText('depmap')).toBeTruthy()
  })

  it('bounds rendered rows across multiple buckets to the row limit', async () => {
    useRelevantBuckets.mockReturnValue([{ name: 'b1' }, { name: 'b2' }])
    tablesByBucket.current = {
      b1: ['t1', 't2', 't3', 't4'],
      b2: ['t5', 't6', 't7', 't8'],
    }
    const { container } = renderTile()
    await waitFor(() => expect(container.querySelectorAll('a').length).toBe(6))
  })

  it('only probes a bounded number of buckets', () => {
    useRelevantBuckets.mockReturnValue(
      Array.from({ length: 12 }, (_, i) => ({ name: `b${i}` })),
    )
    renderTile()
    const probedBuckets = new Set(useQuery.mock.calls.map((c) => (c[1] as any).bucket))
    expect(probedBuckets.size).toBe(6)
  })
})
