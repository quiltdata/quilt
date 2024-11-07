import type * as Model from 'model'
import * as s3paths from 'utils/s3paths'

import type * as requests from './requests'

type ManifestEntryStringified = Record<requests.ManifestKey, string>

export function doQueryResultsContainManifestEntries(
  queryResults: requests.QueryResults,
): queryResults is requests.QueryManifests {
  const columnNames = queryResults.columns.map(({ name }) => name)
  return (
    columnNames.includes('size') &&
    (columnNames.includes('physical_keys') || columnNames.includes('physical_key')) &&
    columnNames.includes('logical_key')
  )
}

// TODO: this name doesn't make sense without `parseManifestEntryStringified`
//       merge it into one
function rowToManifestEntryStringified(
  row: string[],
  columns: requests.QueryResultsColumns,
): ManifestEntryStringified {
  return row.reduce((acc, value, index) => {
    if (!columns[index]?.name) return acc
    return {
      ...acc,
      [columns[index].name]: value,
    }
  }, {} as ManifestEntryStringified)
}

function parseManifestEntryStringified(entry: ManifestEntryStringified): {
  [key: string]: Model.S3File
} | null {
  if (!entry.logical_key) return null
  if (!entry.physical_key && !entry.physical_keys) return null
  try {
    const handle = entry.physical_key
      ? s3paths.parseS3Url(entry.physical_key)
      : s3paths.parseS3Url(entry.physical_keys.replace(/^\[/, '').replace(/\]$/, ''))
    const sizeParsed = Number(entry.size)
    const size = Number.isNaN(sizeParsed) ? 0 : sizeParsed
    return {
      [entry.logical_key]: {
        ...handle,
        size,
      },
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error(e)
    return null
  }
}

export interface ParsedRows {
  valid: Record<string, Model.S3File>
  invalid: requests.QueryResultsRows
}

export function parseQueryResults(queryResults: requests.QueryManifests): ParsedRows {
  // TODO: use one reduce-loop
  //       merge `rowToManifestEntryStringified` and `parseManifestEntryStringified` into one function
  const manifestEntries: ManifestEntryStringified[] = queryResults.rows.reduce(
    (memo, row) => memo.concat(rowToManifestEntryStringified(row, queryResults.columns)),
    [] as ManifestEntryStringified[],
  )
  return manifestEntries.reduce(
    (memo, entry, index) => {
      const parsed = parseManifestEntryStringified(entry)
      return parsed
        ? // if entry is ok then add it to valid map, and invalid is pristine
          {
            valid: {
              ...memo.valid,
              ...parsed,
            },
            invalid: memo.invalid,
          }
        : // if no entry then add original data to list of invalid, and valid is pristine
          {
            valid: memo.valid,
            invalid: [...memo.invalid, queryResults.rows[index]],
          }
    },
    { valid: {}, invalid: [] } as ParsedRows,
  )
}
