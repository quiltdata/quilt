import * as React from 'react'
import * as Sentry from '@sentry/react'

import * as GQL from 'utils/GraphQL'
import * as yaml from 'utils/yaml'

import TABULATOR_TABLES_QUERY from './gql/TabulatorTables.generated'

export interface SourcePattern {
  pretty: string
  raw: string
  isLiteral: boolean
}

export interface TableColumn {
  name: string
  type: string
}

export interface ParsedTabulatorTable {
  name: string
  format: string
  columns: TableColumn[]
  source: { packageName: SourcePattern; logicalKey: SourcePattern } | null
}

// Permissive read-subset of schemas/tabulatorTable.yml.json (the source of truth):
// only the fields we render, all optional/unknown since the parsed YAML is untrusted.
interface RawConfig {
  schema?: ReadonlyArray<{ name?: unknown; type?: unknown }>
  source?: { package_name?: unknown; logical_key?: unknown }
  parser?: { format?: unknown }
}

// A Tabulator `source.package_name` / `logical_key` is a regular expression. For
// exact-match configs it reads cleanly once anchors and escapes are removed; when
// it carries capture groups or other metacharacters it stays raw (and the UI shows
// the raw form in a tooltip regardless).
export function prettifyPattern(raw: string): SourcePattern {
  let body = raw
  if (body.startsWith('^')) body = body.slice(1)
  if (body.endsWith('$') && !body.endsWith('\\$')) body = body.slice(0, -1)
  // Tokenize escape sequences (`\X`) as 2-char units first; any leftover single
  // metacharacter is genuinely unescaped. Avoids a lookbehind (ES2018, which
  // ts-loader emits verbatim under `target: ES5` and would crash old engines).
  const hasMeta = (body.match(/\\.|[.()[\]{}|+*?]/g) ?? []).some((m) => m.length === 1)
  if (hasMeta) return { pretty: raw, raw, isLiteral: false }
  // Drop the escaping backslash before any character (e.g. `\.` -> `.`).
  const pretty = body.replace(/\\(.)/g, '$1')
  return { pretty, raw, isLiteral: true }
}

export function parseTabulatorConfig(name: string, config: string): ParsedTabulatorTable {
  const parsed = yaml.parseStrict<RawConfig>(config)
  if (!parsed || parsed instanceof Error) {
    if (parsed instanceof Error) {
      Sentry.captureException(parsed, { extra: { tabulatorTable: name } })
    }
    return { name, format: '', columns: [], source: null }
  }
  const columns: TableColumn[] = (Array.isArray(parsed.schema) ? parsed.schema : [])
    .filter((c): c is { name: string; type?: unknown } => typeof c?.name === 'string')
    .map((c) => ({ name: c.name, type: typeof c.type === 'string' ? c.type : '' }))
  const format = typeof parsed.parser?.format === 'string' ? parsed.parser.format : ''
  const pkg = parsed.source?.package_name
  const lk = parsed.source?.logical_key
  const source =
    typeof pkg === 'string' && typeof lk === 'string'
      ? { packageName: prettifyPattern(pkg), logicalKey: prettifyPattern(lk) }
      : null
  return { name, format, columns, source }
}

// Tabulator catalogs are named '<stack>-tabulator' by Quilt convention; the first
// matching catalog is used.
export const TABULATOR_CATALOG_SUFFIX = '-tabulator'

export function resolveTabulatorCatalog(
  catalogNames: readonly string[],
): string | undefined {
  return catalogNames.find((name) => name.endsWith(TABULATOR_CATALOG_SUFFIX))
}

type TabulatorTablesData = GQL.DataForDoc<typeof TABULATOR_TABLES_QUERY>

// A null `bucketConfig` (not found / no access) is treated as "no tables".
export function parseTabulatorTables(data: TabulatorTablesData): ParsedTabulatorTable[] {
  return (data.bucketConfig?.tabulatorTables ?? []).map((t) =>
    parseTabulatorConfig(t.name, t.config),
  )
}

export type TabulatorTablesResult =
  | { _tag: 'fetching' }
  | { _tag: 'error'; error: Error }
  | { _tag: 'ready'; tables: ParsedTabulatorTable[] }

export function useTabulatorTables(bucket: string): TabulatorTablesResult {
  const result = GQL.useQuery(TABULATOR_TABLES_QUERY, { bucket })
  // Memoize on the stable query result: parse once per fetch, stable identity.
  return React.useMemo(
    () =>
      GQL.fold(result, {
        data: (d): TabulatorTablesResult => ({
          _tag: 'ready',
          tables: parseTabulatorTables(d),
        }),
        fetching: (): TabulatorTablesResult => ({ _tag: 'fetching' }),
        error: (error): TabulatorTablesResult => ({ _tag: 'error', error }),
      }),
    [result],
  )
}
