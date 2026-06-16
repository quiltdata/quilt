import type A from 'aws-sdk/clients/athena'
import { act, renderHook, cleanup } from '@testing-library/react-hooks'
import { describe, expect, it, vi, afterEach, beforeEach } from 'vitest'

import * as Model from '../Queries/Athena/model/utils'

import { useTablePreview } from './requests'

// Drive the real Athena hook composition (useWorkgroups/useWorkgroup/
// useCatalogNames/useWaitForQueryExecution/useResults) against a mocked AWS
// Athena client, mirroring Queries/Athena/model/requests.spec.ts. The component
// spec mocks useTablePreview wholesale, so this is the only coverage of the
// composition itself — in particular the stale-row race when switching tables.

vi.mock('utils/Logging', () => ({
  default: { error: vi.fn(), info: vi.fn() },
}))

vi.mock('constants/config', () => ({ default: {} }))

vi.mock('utils/storage', () => ({
  default: () => ({ get: () => '' }),
}))

// Callback-style request (getQueryExecution / getQueryResults): resolves async.
function req<I, O>(output: (x: I) => O, delay = 50) {
  return vi.fn((x: I, callback: (e: Error | null, d: O) => void) => {
    const timer = setTimeout(() => callback(null, output(x)), delay)
    return { abort: vi.fn(() => clearTimeout(timer)) }
  })
}

// Promise-style request (listWorkGroups / getWorkGroup / listDataCatalogs /
// startQueryExecution): resolves async.
function reqThen<I, O>(output: (x: I) => O, delay = 50) {
  return vi.fn((x: I) => ({
    promise: () => new Promise((resolve) => setTimeout(() => resolve(output(x)), delay)),
  }))
}

const getDataCatalog = vi.fn()
const getQueryExecution = vi.fn()
const getQueryResults = vi.fn()
const getWorkGroup = vi.fn()
const listDataCatalogs = vi.fn()
const listWorkGroups = vi.fn()
const startQueryExecution = vi.fn()

// Stable client object — `useCatalogNames` etc. depend on the athena instance in
// their effect deps, so a fresh literal per call would restart their fetches on
// every render and never settle.
const athenaClient = {
  getDataCatalog,
  getQueryExecution,
  getQueryResults,
  getWorkGroup,
  listDataCatalogs,
  listWorkGroups,
  startQueryExecution,
}

vi.mock('utils/AWS', () => ({
  Athena: { use: () => athenaClient },
}))

const CATALOG = 'quiltdata-tabulator'

// Map a query (SELECT * FROM "<catalog>"."<bucket>"."<table>" ...) to a per-table
// execution id, so each table's poller/result stream is identifiable.
function tableOf(query: string): string {
  const m = query.match(/"[^"]+"\."[^"]+"\."([^"]+)"/)
  return m ? m[1] : 'unknown'
}
const execId = (table: string) => `exec-${table}`
const rowsFor = (table: string) => [[`row-${table}`]]

function setupAthena() {
  listWorkGroups.mockImplementation(
    reqThen<A.ListWorkGroupsInput, A.ListWorkGroupsOutput>(() => ({
      WorkGroups: [{ Name: 'wg' }],
    })),
  )
  getWorkGroup.mockImplementation(
    reqThen<A.GetWorkGroupInput, A.GetWorkGroupOutput>(({ WorkGroup: Name }) => ({
      WorkGroup: {
        Configuration: { ResultConfiguration: { OutputLocation: 's3://any' } },
        State: 'ENABLED',
        Name,
      },
    })),
  )
  listDataCatalogs.mockImplementation(
    reqThen<A.ListDataCatalogsInput, A.ListDataCatalogsOutput>(() => ({
      DataCatalogsSummary: [{ CatalogName: CATALOG }],
    })),
  )
  // useCatalogNames validates each non-default catalog via getDataCatalog.
  getDataCatalog.mockImplementation(
    reqThen<A.GetDataCatalogInput, A.GetDataCatalogOutput>(({ Name }) => ({
      DataCatalog: { Name, Type: 'any' },
    })),
  )
  // startQueryExecution returns a per-table execution id derived from the query.
  startQueryExecution.mockImplementation(
    reqThen<A.StartQueryExecutionInput, A.StartQueryExecutionOutput>(
      ({ QueryString }) => ({
        QueryExecutionId: execId(tableOf(QueryString)),
      }),
    ),
  )
  // The execution for a given id is always SUCCEEDED and carries its own id back.
  getQueryExecution.mockImplementation(
    req<A.GetQueryExecutionInput, A.GetQueryExecutionOutput>(({ QueryExecutionId }) => ({
      QueryExecution: {
        QueryExecutionId,
        Status: { State: 'SUCCEEDED' },
      },
    })),
  )
  // Results are keyed by the execution id -> a single distinguishable row.
  getQueryResults.mockImplementation(
    req<A.GetQueryResultsInput, A.GetQueryResultsOutput>(({ QueryExecutionId }) => {
      const table = (QueryExecutionId || '').replace(/^exec-/, '')
      return {
        ResultSet: {
          Rows: [{ Data: [{ VarCharValue: `row-${table}` }] }],
          ResultSetMetadata: { ColumnInfo: [{ Name: 'c', Type: 'varchar' }] },
        },
      }
    }),
  )
}

describe('containers/Bucket/Tabulator/requests/useTablePreview', () => {
  beforeEach(setupAthena)
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  type Result = {
    current: {
      open: (t: string) => void
      close: () => void
      preview: { table: string; results: Model.Data<unknown> } | null
    }
  }

  // Eager workgroup/catalog resolution is async (and the hook exposes no direct
  // readiness flag), so opening before the tabulator catalog resolves yields a
  // "catalog not found" error. Open `table`, and if it lands on that start-time
  // error (catalog not yet resolved), toggle it closed and retry until the open
  // produces a non-error preview. Leaves `table` open on success.
  // The execution poller (useWaitForQueryExecution) advances on a real 1000ms
  // setInterval, so every "wait for the query to settle" assertion needs more than
  // one tick of headroom. The default 1000ms waitFor timeout barely covers a single
  // tick in isolation and is regularly exceeded under full-suite scheduler
  // contention, making the test flaky. Use a generous ceiling (matching the sibling
  // Queries/Athena/model/requests.spec.ts); it resolves fast in practice, the high
  // limit only absorbs jitter.
  const POLL_WAIT = { timeout: 8000 }

  async function openWhenReady(
    result: Result,
    waitFor: (cb: () => boolean, opts?: { timeout?: number }) => Promise<void>,
    table: string,
  ) {
    await waitFor(() => {
      const p = result.current.preview
      if (p?.table === table && !Model.isError(p.results)) return true
      // Either nothing open yet, or the last attempt errored: (re)open.
      if (p?.table === table) act(() => result.current.close())
      act(() => result.current.open(table))
      return false
    }, POLL_WAIT)
  }

  it('goes open -> loading -> rows for a single table', async () => {
    await act(async () => {
      const { result, waitFor, unmount } = renderHook(() => useTablePreview('b'))

      await openWhenReady(result, waitFor, 'A')
      // Once the catalog is resolved, the open preview is Loading (no rows yet).
      expect(result.current.preview).toMatchObject({ table: 'A', results: Model.Loading })

      await waitFor(() => Model.hasData(result.current.preview?.results), POLL_WAIT)
      expect(result.current.preview).toMatchObject({
        table: 'A',
        results: { rows: rowsFor('A') },
      })

      unmount()
    })
  })

  it('does not surface table A rows under table B when switching (stale-row race)', async () => {
    await act(async () => {
      const { result, waitFor, unmount } = renderHook(() => useTablePreview('b'))

      // Open A and let it fully resolve to A's rows.
      await openWhenReady(result, waitFor, 'A')
      await waitFor(() => Model.hasData(result.current.preview?.results), POLL_WAIT)
      expect(result.current.preview).toMatchObject({
        table: 'A',
        results: { rows: rowsFor('A') },
      })

      const beforeSwitch = result.all.length

      // Switch to B and let B resolve.
      act(() => result.current.open('B'))
      await waitFor(
        () =>
          result.current.preview?.table === 'B' &&
          Model.hasData(result.current.preview.results),
        POLL_WAIT,
      )

      // Inspect EVERY render recorded since the switch (result.all captures each
      // render, so a stale frame can't slip between waitFor polls). Across the
      // whole A->B transition, the preview labelled B must never carry A's rows;
      // the identity gate (settled.id === executionId) enforces this even when the
      // settled execution / cached results still reference A for a render.
      const staleBleed = result.all
        .slice(beforeSwitch)
        .map((r) => (r instanceof Error ? null : r.preview))
        .some(
          (p) =>
            p?.table === 'B' &&
            Model.hasData(p.results) &&
            JSON.stringify(p.results.rows) === JSON.stringify(rowsFor('A')),
        )
      expect(staleBleed).toBe(false)

      // B eventually shows its own rows.
      expect(result.current.preview).toMatchObject({
        table: 'B',
        results: { rows: rowsFor('B') },
      })

      unmount()
    })
  })
})
