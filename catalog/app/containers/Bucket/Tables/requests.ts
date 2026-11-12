// Data layer for the Tables tab (table-support v1).
//
// Tables are read straight from Athena metadata APIs (ListTableMetadata /
// GetTableMetadata): the catalog frontend already holds Athena credentials for
// the Queries tab, and Athena proxies Glue (including cross-account catalogs
// registered as Athena data catalogs, e.g. quilt_staging_catalog), so no new
// client or backend is needed.
//
// Quilt context metadata (description, column semantics, example questions)
// persists as a JSON file at .quilt/tables/<catalog>/<database>/<table>.json
// in the volume bucket, written with the caller's S3 credentials.
// TODO(table-support): persistence is an open question for Alexei — Glue table
// parameters vs volume registry vs this sidecar file. The sidecar is the
// sandbox-cheapest option and needs no write access to the (cross-account)
// Glue catalog, but it is not indexed for search yet.

import type { Athena, AWSError, S3 } from 'aws-sdk'
import * as React from 'react'

import * as AWS from 'utils/AWS'
import Log from 'utils/Logging'
import noop from 'utils/noop'

import * as Model from 'containers/Queries/Athena/model/utils'
import {
  useWorkgroup,
  useWorkgroups,
  type QueryResults,
} from 'containers/Queries/Athena/model/requests'

const MAX_RESULTS_PER_PAGE = 50

export interface TableColumn {
  name: string
  type: string
  comment?: string
  partitionKey?: boolean
}

export type TableFormat = 'iceberg' | 'parquet' | 'other'

// One Glue/Athena table, addressed by its honest query coordinates.
export interface TableSummary {
  catalog: string
  database: string
  name: string
  format: TableFormat
  // Last Glue update when known; Iceberg tables carry no reliable row count in
  // Glue parameters, so freshness is the honest signal here.
  updatedAt?: Date
  columnCount: number
}

export interface TableDetail extends TableSummary {
  columns: TableColumn[]
  location?: string
  tableType?: string
  parameters: Record<string, string>
}

function parseFormat(params: Record<string, string> | undefined): TableFormat {
  const t = params?.table_type?.toLowerCase()
  if (t === 'iceberg') return 'iceberg'
  const loc = params?.location || ''
  if (loc.includes('parquet') || params?.classification === 'parquet') return 'parquet'
  return 'other'
}

// Glue reports epoch-0 timestamps for tables that never recorded an update;
// show nothing rather than "57 years ago".
const realDate = (d?: Date) => (d && d.getTime() > 0 ? d : undefined)

function parseSummary(
  catalog: string,
  database: string,
  t: Athena.TableMetadata,
): TableSummary {
  return {
    catalog,
    database,
    name: t.Name,
    format: parseFormat(t.Parameters),
    updatedAt: realDate(t.LastAccessTime) || realDate(t.CreateTime),
    columnCount: (t.Columns || []).length,
  }
}

function parseColumns(t: Athena.TableMetadata): TableColumn[] {
  const cols = (t.Columns || []).map((c) => ({
    name: c.Name,
    type: c.Type || '',
    comment: c.Comment,
  }))
  const parts = (t.PartitionKeys || []).map((c) => ({
    name: c.Name,
    type: c.Type || '',
    comment: c.Comment,
    partitionKey: true,
  }))
  return cols.concat(parts)
}

function parseDetail(
  catalog: string,
  database: string,
  t: Athena.TableMetadata,
): TableDetail {
  return {
    ...parseSummary(catalog, database, t),
    columns: parseColumns(t),
    location: t.Parameters?.location,
    tableType: t.TableType,
    parameters: t.Parameters || {},
  }
}

// On the sandbox every registered catalog's databases/tables are listed. The
// volume-to-database registry (ruling C naming) is not built yet, so the
// Tables tab shows everything the caller's role can see through Athena.
// TODO(table-support): scope to the volume's own Glue database once the
// registry lands.
async function fetchCatalogNames(
  athena: Athena,
  isMounted: () => boolean,
): Promise<string[]> {
  const list: string[] = []
  let token: string | undefined
  do {
    if (!isMounted()) return list
    const out = await athena
      .listDataCatalogs({ NextToken: token, MaxResults: MAX_RESULTS_PER_PAGE })
      .promise()
    const parsed = (out.DataCatalogsSummary || [])
      .map((c) => c.CatalogName || '')
      .filter(Boolean)
    list.push(...parsed)
    token = out.NextToken
  } while (token)
  return list.sort()
}

async function fetchDatabases(
  athena: Athena,
  catalog: string,
  isMounted: () => boolean,
): Promise<string[]> {
  const list: string[] = []
  let token: string | undefined
  do {
    if (!isMounted()) return list
    const out = await athena
      .listDatabases({
        CatalogName: catalog,
        NextToken: token,
        MaxResults: MAX_RESULTS_PER_PAGE,
      })
      .promise()
    list.push(...(out.DatabaseList || []).map((d) => d.Name || '').filter(Boolean))
    token = out.NextToken
  } while (token)
  return list.sort()
}

async function fetchTablesInDatabase(
  athena: Athena,
  catalog: string,
  database: string,
  isMounted: () => boolean,
): Promise<TableSummary[]> {
  const list: TableSummary[] = []
  let token: string | undefined
  do {
    if (!isMounted()) return list
    const out = await athena
      .listTableMetadata({
        CatalogName: catalog,
        DatabaseName: database,
        NextToken: token,
        MaxResults: MAX_RESULTS_PER_PAGE,
      })
      .promise()
    list.push(
      ...(out.TableMetadataList || []).map((t) => parseSummary(catalog, database, t)),
    )
    token = out.NextToken
  } while (token)
  return list
}

export interface DatabaseGroup {
  catalog: string
  database: string
  tables: TableSummary[]
}

// Hidden by default: internal/system databases that would drown the signal.
const HIDDEN_DATABASES = new Set(['default', 'sampledb', 'information_schema'])

function isAccessError(e: unknown): boolean {
  const code = (e as AWSError)?.code
  return (
    code === 'AccessDeniedException' ||
    code === 'MetadataException' ||
    code === 'InvalidRequestException'
  )
}

async function fetchAllTables(
  athena: Athena,
  isMounted: () => boolean,
): Promise<DatabaseGroup[]> {
  const catalogs = await fetchCatalogNames(athena, isMounted)
  const groups: DatabaseGroup[] = []
  for (const catalog of catalogs) {
    let databases: string[] = []
    try {
      databases = await fetchDatabases(athena, catalog, isMounted)
    } catch (e) {
      // Federated catalogs (Tabulator connector) can refuse metadata listing
      // outside a query context; skip rather than fail the whole tab.
      if (isAccessError(e)) {
        Log.info(`Listing databases in catalog "${catalog}" failed, skipping`, e)
        continue
      }
      throw e
    }
    for (const database of databases) {
      if (HIDDEN_DATABASES.has(database.toLowerCase())) continue
      if (!isMounted()) return groups
      try {
        const tables = await fetchTablesInDatabase(athena, catalog, database, isMounted)
        if (tables.length) groups.push({ catalog, database, tables })
      } catch (e) {
        if (isAccessError(e)) {
          Log.info(`Listing tables in "${catalog}"."${database}" failed, skipping`, e)
          continue
        }
        throw e
      }
    }
  }
  return groups
}

export function useTables(): Model.DataController<DatabaseGroup[]> {
  const athena = AWS.Athena.use()
  const [data, setData] = React.useState<Model.Data<DatabaseGroup[]>>()
  React.useEffect(() => {
    if (!athena) return
    let mounted = true
    setData(Model.Loading)
    fetchAllTables(athena, () => mounted)
      .then((d) => mounted && setData(d))
      .catch((e) => mounted && setData(e instanceof Error ? e : new Error(String(e))))
    return () => {
      mounted = false
    }
  }, [athena])
  return React.useMemo(() => ({ data, loadMore: noop }), [data])
}

export function useTable(
  catalog: string,
  database: string,
  table: string,
): Model.DataController<TableDetail> {
  const athena = AWS.Athena.use()
  const [data, setData] = React.useState<Model.Data<TableDetail>>()
  React.useEffect(() => {
    if (!athena) return
    let mounted = true
    setData(Model.Loading)
    athena
      .getTableMetadata({
        CatalogName: catalog,
        DatabaseName: database,
        TableName: table,
      })
      .promise()
      .then((out) => {
        if (!mounted) return
        if (!out.TableMetadata) {
          setData(new Error(`Table "${table}" not found`))
          return
        }
        setData(parseDetail(catalog, database, out.TableMetadata))
      })
      .catch((e) => mounted && setData(e instanceof Error ? e : new Error(String(e))))
    return () => {
      mounted = false
    }
  }, [athena, catalog, database, table])
  return React.useMemo(() => ({ data, loadMore: noop }), [data])
}

// ---------------------------------------------------------------------------
// Quilt context metadata (the editable layer: Glue carries schema, Quilt
// carries meaning).

export interface TableContext {
  description: string
  rowMeaning: string
  exampleQuestions: string[]
  columnSemantics: Record<string, string>
}

export const emptyContext: TableContext = {
  description: '',
  rowMeaning: '',
  exampleQuestions: [],
  columnSemantics: {},
}

const contextKey = (catalog: string, database: string, table: string) =>
  `.quilt/tables/${catalog}/${database}/${table}.json`

function parseContext(body: string): TableContext {
  try {
    const raw = JSON.parse(body)
    return {
      description: typeof raw.description === 'string' ? raw.description : '',
      rowMeaning: typeof raw.rowMeaning === 'string' ? raw.rowMeaning : '',
      exampleQuestions: Array.isArray(raw.exampleQuestions)
        ? raw.exampleQuestions.filter((q: unknown) => typeof q === 'string')
        : [],
      columnSemantics:
        raw.columnSemantics && typeof raw.columnSemantics === 'object'
          ? raw.columnSemantics
          : {},
    }
  } catch {
    return emptyContext
  }
}

interface TableContextController {
  value: Model.Data<TableContext>
  save: (next: TableContext) => Promise<void>
  saving: boolean
}

export function useTableContext(
  bucket: string,
  catalog: string,
  database: string,
  table: string,
): TableContextController {
  const s3: S3 = AWS.S3.use()
  const [value, setValue] = React.useState<Model.Data<TableContext>>()
  const [saving, setSaving] = React.useState(false)
  const key = contextKey(catalog, database, table)
  React.useEffect(() => {
    let mounted = true
    setValue(Model.Loading)
    s3.getObject({ Bucket: bucket, Key: key })
      .promise()
      .then((out) => {
        if (!mounted) return
        setValue(parseContext(out.Body?.toString('utf-8') || ''))
      })
      .catch((e) => {
        if (!mounted) return
        const code = (e as AWSError)?.code
        if (code === 'NoSuchKey' || code === 'NotFound') {
          setValue(emptyContext)
        } else {
          setValue(e instanceof Error ? e : new Error(String(e)))
        }
      })
    return () => {
      mounted = false
    }
  }, [s3, bucket, key])
  const save = React.useCallback(
    async (next: TableContext) => {
      setSaving(true)
      try {
        await s3
          .putObject({
            Bucket: bucket,
            Key: key,
            Body: JSON.stringify(next, null, 2),
            ContentType: 'application/json',
          })
          .promise()
        setValue(next)
      } finally {
        setSaving(false)
      }
    },
    [s3, bucket, key],
  )
  return { value, save, saving }
}

// ---------------------------------------------------------------------------
// Preview: SELECT * LIMIT n through Athena, polling the execution to
// completion. Kept self-contained (vs the Queries model) because the preview
// is read-only and needs no editor state.

// Athena/Presto identifier quoting: double any embedded double quote.
const quoteIdent = (s: string) => `"${s.replace(/"/g, '""')}"`

export const previewQuery = (
  catalog: string,
  database: string,
  table: string,
  limit: number = 50,
) =>
  `SELECT * FROM ${quoteIdent(catalog)}.${quoteIdent(database)}.${quoteIdent(
    table,
  )} LIMIT ${limit}`

const PREVIEW_POLL_MS = 1000
const PREVIEW_MAX_POLLS = 60

async function runPreview(
  athena: Athena,
  workgroup: string,
  sql: string,
  isMounted: () => boolean,
): Promise<QueryResults> {
  const started = await athena
    .startQueryExecution({
      QueryString: sql,
      WorkGroup: workgroup,
      ResultConfiguration: {
        EncryptionConfiguration: { EncryptionOption: 'SSE_S3' },
      },
    })
    .promise()
  const id = started.QueryExecutionId
  if (!id) throw new Error('No execution id')
  for (let i = 0; i < PREVIEW_MAX_POLLS; i++) {
    if (!isMounted()) throw new Error('Unmounted')
    await new Promise((resolve) => setTimeout(resolve, PREVIEW_POLL_MS))
    const out = await athena.getQueryExecution({ QueryExecutionId: id }).promise()
    const state = out.QueryExecution?.Status?.State
    if (state === 'SUCCEEDED') break
    if (state === 'FAILED' || state === 'CANCELLED') {
      throw new Error(out.QueryExecution?.Status?.StateChangeReason || state)
    }
    if (i === PREVIEW_MAX_POLLS - 1) throw new Error('Preview timed out')
  }
  const res = await athena.getQueryResults({ QueryExecutionId: id }).promise()
  const rows =
    res.ResultSet?.Rows?.map((r) => (r.Data || []).map((d) => d.VarCharValue || '')) || []
  const columns =
    res.ResultSet?.ResultSetMetadata?.ColumnInfo?.map((c) => ({
      name: c.Name,
      type: c.Type,
    })) || []
  const isHeadColumns = columns.every(({ name }, index) => name === rows[0]?.[index])
  return { rows: isHeadColumns ? rows.slice(1) : rows, columns }
}

interface PreviewController {
  data: Model.Data<QueryResults>
  // null until the workgroup list settles
  run: (() => void) | null
  running: boolean
}

export function usePreview(
  catalog: string,
  database: string,
  table: string,
): PreviewController {
  const athena = AWS.Athena.use()
  const workgroups = useWorkgroups()
  const workgroup = useWorkgroup(workgroups)
  const [data, setData] = React.useState<Model.Data<QueryResults>>()
  const [running, setRunning] = React.useState(false)
  const mountedRef = React.useRef(true)
  React.useEffect(
    () => () => {
      mountedRef.current = false
    },
    [],
  )
  const wg = Model.hasData(workgroup.data) ? workgroup.data : null
  const run = React.useMemo(() => {
    if (!athena || !wg) return null
    return () => {
      setRunning(true)
      setData(Model.Loading)
      runPreview(
        athena,
        wg,
        previewQuery(catalog, database, table),
        () => mountedRef.current,
      )
        .then((d) => mountedRef.current && setData(d))
        .catch(
          (e) =>
            mountedRef.current && setData(e instanceof Error ? e : new Error(String(e))),
        )
        .finally(() => mountedRef.current && setRunning(false))
    }
  }, [athena, wg, catalog, database, table])
  return { data, run, running }
}
