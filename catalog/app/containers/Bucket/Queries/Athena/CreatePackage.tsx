import * as React from 'react'
import * as M from '@material-ui/core'

import * as Dialog from 'components/Dialog'
import * as AddToPackage from 'containers/AddToPackage'
import { usePackageCreationDialog } from 'containers/Bucket/PackageDialog/PackageCreationForm'
import type * as Model from 'model'
import * as s3paths from 'utils/s3paths'

import * as requests from '../requests'

import Results from './Results'

type ManifestKey = 'hash' | 'logical_key' | 'meta' | 'physical_keys' | 'size'
type ManifestEntryStringified = Record<ManifestKey, string>

function SeeDocsForCreatingPackage() {
  return (
    <M.Tooltip title="You can create packages from the query results. Click to see the docs.">
      <a href="https://docs.quiltdata.com/advanced/athena" target="_blank">
        <M.IconButton>
          <M.Icon>help_outline</M.Icon>
        </M.IconButton>
      </a>
    </M.Tooltip>
  )
}

function doQueryResultsContainManifestEntries(
  queryResults: requests.athena.QueryResultsResponse,
): queryResults is requests.athena.QueryManifestsResponse {
  const columnNames = queryResults.columns.map(({ name }) => name)
  return (
    columnNames.includes('size') &&
    columnNames.includes('physical_keys') &&
    columnNames.includes('logical_key')
  )
}

// TODO: this name doesn't make sense without `parseManifestEntryStringified`
//       merge it into one
function rowToManifestEntryStringified(
  row: string[],
  columns: requests.athena.QueryResultsColumns,
): ManifestEntryStringified {
  return row.reduce((acc, value, index) => {
    if (!columns[index].name) return acc
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
  if (!entry.physical_keys) return null
  try {
    const handle = s3paths.parseS3Url(
      entry.physical_keys.replace(/^\[/, '').replace(/\]$/, ''),
    )
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

interface ParsedRows {
  valid: Record<string, Model.S3File>
  invalid: requests.athena.QueryResultsRows
}

function parseQueryResults(
  queryResults: requests.athena.QueryManifestsResponse,
): ParsedRows {
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

const useStyles = M.makeStyles((t) => ({
  results: {
    'div&': {
      // NOTE: increasing CSS specifity to overwrite
      minHeight: t.spacing(30),
    },
  },
}))

interface CreatePackageProps {
  bucket: string
  queryResults: requests.athena.QueryResultsResponse
}

export default function CreatePackage({ bucket, queryResults }: CreatePackageProps) {
  const classes = useStyles()
  const [entries, setEntries] = React.useState<ParsedRows>({ valid: {}, invalid: [] })
  const addToPackage = AddToPackage.use()
  const createDialog = usePackageCreationDialog({
    bucket,
    delayHashing: true,
    disableStateDisplay: true,
  })
  const handleConfirm = React.useCallback(
    (ok: boolean) => {
      if (!ok) return
      addToPackage?.merge(entries.valid)
      createDialog.open()
    },
    [addToPackage, entries, createDialog],
  )
  const confirm = Dialog.useConfirm({
    title: 'These rows will be discarded. Confirm creating package?',
    onSubmit: handleConfirm,
  })
  const onPackage = React.useCallback(() => {
    if (!doQueryResultsContainManifestEntries(queryResults)) return

    // TODO: make it lazy, and disable button
    const parsed = parseQueryResults(queryResults)
    setEntries(parsed)
    if (parsed.invalid.length) {
      confirm.open()
    } else {
      addToPackage?.merge(parsed.valid)
      createDialog.open()
    }
  }, [addToPackage, confirm, createDialog, queryResults])

  if (!doQueryResultsContainManifestEntries(queryResults)) {
    return <SeeDocsForCreatingPackage />
  }

  return (
    <>
      {createDialog.render({
        successTitle: 'Package created',
        successRenderMessage: ({ packageLink }) => (
          <>Package {packageLink} successfully created</>
        ),
        title: 'Create package',
      })}
      {confirm.render(
        <Results
          className={classes.results}
          rows={entries.invalid}
          columns={queryResults.columns}
        />,
      )}
      <M.Button color="primary" onClick={onPackage} size="small" variant="outlined">
        Create package
      </M.Button>
    </>
  )
}
