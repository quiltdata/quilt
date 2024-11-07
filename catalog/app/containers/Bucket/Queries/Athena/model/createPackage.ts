import type * as Model from 'model'
import * as s3paths from 'utils/s3paths'

import type * as requests from './requests'

export function doQueryResultsContainManifestEntries(
  queryResults: requests.QueryResults,
): queryResults is requests.QueryManifests {
  if (!queryResults.rows.length) return false
  const columnNames = queryResults.columns.map(({ name }) => name)
  return (
    columnNames.includes('size') &&
    (columnNames.includes('physical_keys') || columnNames.includes('physical_key')) &&
    columnNames.includes('logical_key')
  )
}

type Row = requests.QueryManifests['rows'][0]
function parseRow(
  row: Row,
  columns: requests.QueryResultsColumns,
): { fail?: undefined; ok: [string, Model.S3File] } | { fail: Row; ok?: undefined } {
  try {
    const entry = row.reduce(
      (acc, value, index) => {
        if (!columns[index]?.name) return acc
        return {
          ...acc,
          [columns[index].name]: value,
        }
      },
      {} as Record<requests.ManifestKey, string>,
    )
    if (!entry.logical_key) return { fail: row }
    if (!entry.physical_key && !entry.physical_keys) return { fail: row }
    const handle = entry.physical_key
      ? s3paths.parseS3Url(entry.physical_key)
      : s3paths.parseS3Url(entry.physical_keys.replace(/^\[/, '').replace(/\]$/, ''))
    const sizeParsed = Number(entry.size)
    const size = Number.isNaN(sizeParsed) ? 0 : sizeParsed
    return {
      ok: [
        entry.logical_key,
        {
          ...handle,
          size,
        },
      ],
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error(e)
    return { fail: row }
  }
}

export interface ParsedRows {
  valid: Record<string, Model.S3File>
  invalid: requests.QueryResultsRows
}

export function parseQueryResults(queryResults: requests.QueryManifests): ParsedRows {
  return queryResults.rows
    .map((row) => parseRow(row, queryResults.columns))
    .reduce(
      (memo, { ok, fail }) =>
        ok
          ? {
              valid: {
                ...memo.valid,
                [ok[0]]: ok[1],
              },
              invalid: memo.invalid,
            }
          : {
              valid: memo.valid,
              invalid: [...memo.invalid, fail],
            },
      { valid: {}, invalid: [] } as ParsedRows,
    )
}
