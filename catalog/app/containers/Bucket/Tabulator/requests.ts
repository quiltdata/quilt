import type { Athena as AthenaSDK } from 'aws-sdk'
import * as React from 'react'

import * as AWS from 'utils/AWS'
import * as GQL from 'utils/GraphQL'
import Log from 'utils/Logging'

// Athena requests/hooks are reused here so the Overview page can run a bounded,
// read-only table preview without the Queries page's workgroup/catalog pickers.
import * as Athena from '../Queries/Athena/model/requests'
// Schema-free generic async-state helpers; they merely live under the Athena
// folder. Candidate for relocation to a neutral `utils/` location.
import * as Model from '../Queries/Athena/model/utils'

import TABULATOR_TABLES_QUERY from './gql/TabulatorTables.generated'

export interface TabulatorTable {
  name: string
}

export function useTabulatorTables(
  bucket: string,
): Model.Data<readonly TabulatorTable[]> {
  const result = GQL.useQuery(TABULATOR_TABLES_QUERY, { bucket })
  return GQL.fold(result, {
    // A null `bucketConfig` (not found / no access) is treated as "no tables".
    data: (d) => d.bucketConfig?.tabulatorTables ?? [],
    fetching: () => Model.Loading,
    error: (e) => e,
  })
}

// Table previews reuse Athena's cached results for an identical query within this
// window, sparing a redundant data scan. Kept short because reuse serves stale data
// if the table changed since the cached run; a preview tolerates minor staleness.
const TABLE_PREVIEW_RESULT_REUSE_MIN = 5

// Tabulator catalogs are named '<stack>-tabulator' by Quilt convention; if several
// match, the first is used. The per-bucket database is the bucket name.
const TABULATOR_CATALOG_SUFFIX = '-tabulator'

function resolveTabulatorCatalog(
  catalogNames: Model.Data<Model.List<Athena.CatalogName>>,
): Athena.CatalogName | undefined {
  if (!Model.hasData(catalogNames)) return undefined
  return catalogNames.list.find((c) => c.endsWith(TABULATOR_CATALOG_SUFFIX))
}

export interface TablePreview {
  table: string
  results: Model.Data<Athena.QueryResults>
}

export interface TablePreviewController {
  /** The currently open preview, or null when none is open. */
  preview: TablePreview | null
  /** Open a preview for `table`, running the bounded query. Toggles closed if already open. */
  open: (table: string) => void
  /** Close the open preview. */
  close: () => void
}

// Runs `SELECT * FROM "<catalog>"."<database>"."<table>" LIMIT <n>` and exposes
// the first rows. Resolves workgroup + tabulator catalog headlessly via the
// existing Athena requests; only one preview is active at a time.
export function useTablePreview(bucket: string): TablePreviewController {
  const athena = AWS.Athena.use()

  // TODO: workgroup + catalog resolve eagerly on mount, even before any preview is
  // opened, adding their Athena round-trips to the Overview page's load cost. Could
  // be lazified to first-open; left eager as a deliberate prototype tradeoff.
  const workgroups = Athena.useWorkgroups()
  const workgroup = Athena.useWorkgroup(workgroups)
  const catalogNames = Athena.useCatalogNames(workgroup.data)

  const [table, setTable] = React.useState<string | null>(null)
  const [execution, setExecution] =
    React.useState<Model.Value<Athena.QueryExecution>>(null)

  const run = React.useCallback(
    async (catalog: Athena.CatalogName | undefined, t: string) => {
      if (!catalog) {
        setExecution(new Error('Tabulator catalog not found'))
        return
      }
      if (!Model.hasData(workgroup.data)) {
        setExecution(new Error('No workgroup'))
        return
      }
      const options: AthenaSDK.Types.StartQueryExecutionInput = {
        QueryString: `SELECT * FROM "${catalog}"."${bucket}"."${t}" LIMIT 100`,
        ResultConfiguration: {
          EncryptionConfiguration: { EncryptionOption: 'SSE_S3' },
        },
        WorkGroup: workgroup.data,
        QueryExecutionContext: { Catalog: catalog, Database: bucket },
        ResultReuseConfiguration: {
          ResultReuseByAgeConfiguration: {
            Enabled: true,
            MaxAgeInMinutes: TABLE_PREVIEW_RESULT_REUSE_MIN,
          },
        },
      }
      setExecution(Model.Loading)
      try {
        const d = await athena?.startQueryExecution(options).promise()
        const id = d?.QueryExecutionId
        if (!id) {
          const error = new Error('No execution id')
          Log.error(error)
          setExecution(error)
          return
        }
        // Hand off to the execution poller via its id.
        setExecution({ id })
      } catch (error) {
        Log.error(error)
        setExecution(error instanceof Error ? error : new Error('Preview failed'))
      }
    },
    [athena, bucket, workgroup.data],
  )

  const open = React.useCallback(
    (t: string) => {
      if (t === table) {
        // Toggle the open row closed.
        setTable(null)
        setExecution(null)
        return
      }
      setTable(t)
      run(resolveTabulatorCatalog(catalogNames.data), t)
    },
    [table, run, catalogNames.data],
  )

  const close = React.useCallback(() => {
    setTable(null)
    setExecution(null)
  }, [])

  // Poll the execution until it settles, then fetch the result rows.
  const executionId = Model.hasData(execution) && execution.id ? execution.id : undefined
  const waited = Athena.useWaitForQueryExecution(executionId)
  // Prefer a start-time error (e.g. no catalog) over the polled execution.
  const settled = Model.isError(execution) ? execution : waited
  const results = Athena.useResults(settled)

  const preview = React.useMemo<TablePreview | null>(() => {
    if (table === null) return null
    // Surface a start-time error (e.g. no catalog / no workgroup) directly, without
    // a one-frame progress flash while it propagates through useResults.
    if (Model.isError(execution)) return { table, results: execution }
    // While the start request is in flight (no execution id yet) surface Loading.
    if (
      execution === Model.Loading ||
      (Model.hasData(execution) && !Model.isReady(settled))
    ) {
      return { table, results: Model.Loading }
    }
    // Only surface rows once the settled execution corresponds to the CURRENT
    // execution id. When switching A->B, the settled execution + results still
    // reference A for one render until the poller restarts on B's id; gating on
    // identity shows Loading instead of A's stale rows under B.
    const ready = Model.hasData(settled) && settled.id === executionId
    return { table, results: ready ? results.data : Model.Loading }
  }, [table, execution, executionId, settled, results.data])

  return React.useMemo(() => ({ preview, open, close }), [preview, open, close])
}
