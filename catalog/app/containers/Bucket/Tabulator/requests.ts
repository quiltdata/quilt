import * as GQL from 'utils/GraphQL'
import * as yaml from 'utils/yaml'

import * as Model from '../Queries/Athena/model/utils'

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
  const hasMeta = /(?<!\\)[.()[\]{}|+*?]/.test(body)
  if (hasMeta) return { pretty: raw, raw, isLiteral: false }
  // Drop the escaping backslash before any character (e.g. `\.` -> `.`).
  const pretty = body.replace(/\\(.)/g, '$1')
  return { pretty, raw, isLiteral: true }
}

export function parseTabulatorConfig(name: string, config: string): ParsedTabulatorTable {
  const parsed = yaml.parse(config) as RawConfig | undefined
  const columns: TableColumn[] = (Array.isArray(parsed?.schema) ? parsed!.schema : [])
    .filter((c): c is { name: string; type?: unknown } => typeof c?.name === 'string')
    .map((c) => ({ name: c.name, type: typeof c.type === 'string' ? c.type : '' }))
  const format = typeof parsed?.parser?.format === 'string' ? parsed.parser.format : ''
  const pkg = parsed?.source?.package_name
  const lk = parsed?.source?.logical_key
  const source =
    typeof pkg === 'string' && typeof lk === 'string'
      ? { packageName: prettifyPattern(pkg), logicalKey: prettifyPattern(lk) }
      : null
  return { name, format, columns, source }
}

export function useTabulatorTables(
  bucket: string,
): Model.Data<readonly ParsedTabulatorTable[]> {
  const result = GQL.useQuery(TABULATOR_TABLES_QUERY, { bucket })
  return GQL.fold(result, {
    // A null `bucketConfig` (not found / no access) is treated as "no tables".
    data: (d) =>
      (d.bucketConfig?.tabulatorTables ?? []).map((t) =>
        parseTabulatorConfig(t.name, t.config),
      ),
    fetching: () => Model.Loading,
    error: (e) => e,
  })
}
