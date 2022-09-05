import * as React from 'react'
import * as M from '@material-ui/core'

import * as Dialog from 'components/Dialog'
import * as AddToPackage from 'containers/AddToPackage'
import { usePackageCreationDialog } from 'containers/Bucket/PackageDialog/PackageCreationForm'
import type * as Model from 'model'
import * as s3paths from 'utils/s3paths'

import * as requests from '../requests'

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
  rows: string[][],
): rows is [ManifestKey[], ...string[][]] {
  const [head] = rows
  return (
    head.includes('size') &&
    head.includes('physical_keys') &&
    head.includes('logical_key')
  )
}

function rowToManifestEntryStringified(
  row: string[],
  head: ManifestKey[],
): ManifestEntryStringified {
  return row.reduce((acc, value, index) => {
    if (!head[index]) return acc
    return {
      ...acc,
      [head[index]]: value,
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
  invalid: Error[]
}

function parseQueryResults(rows: [ManifestKey[], ...string[][]]): ParsedRows {
  const [head, ...tail] = rows
  const manifestEntries: ManifestEntryStringified[] = tail.reduce(
    (memo, row) => memo.concat(rowToManifestEntryStringified(row, head)),
    [] as ManifestEntryStringified[],
  )
  return manifestEntries.reduce(
    (memo, entry) => {
      const parsed = parseManifestEntryStringified(entry)
      if (parsed) {
        // FIXME if (parsed instanceof Error)
        return {
          valid: {
            ...memo.valid,
            ...parsed,
          },
          invalid: memo.invalid,
        }
      }
      return {
        valid: memo.valid,
        invalid: memo.invalid.concat(new Error('INVALID ROW')),
      }
    },
    { valid: {}, invalid: [] } as ParsedRows,
  )
}

interface CreatePackageProps {
  bucket: string
  rows: requests.athena.QueryResultsRows
}

export default function CreatePackage({ bucket, rows }: CreatePackageProps) {
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
    [addToPackage, createDialog],
  )
  const confirm = Dialog.useConfirm({
    title: 'Confirm',
    onSubmit: handleConfirm,
  })
  const onPackage = React.useCallback(() => {
    if (!doQueryResultsContainManifestEntries(rows)) return

    // TODO: make it lazy, and disable button
    const entries = parseQueryResults(rows)
    setEntries(entries)
    if (entries.invalid.length) {
      confirm.open()
    } else {
      handleConfirm(true)
    }
  }, [addToPackage, createDialog, rows])

  if (!doQueryResultsContainManifestEntries(rows)) return <SeeDocsForCreatingPackage />

  return (
    <>
      {createDialog.render({
        successTitle: 'Package created',
        successRenderMessage: ({ packageLink }) => (
          <>Package {packageLink} successfully created</>
        ),
        title: 'Create package',
      })}
      {confirm.render(<h1>Hello world!</h1>)}
      <M.Button color="primary" onClick={onPackage} size="small" variant="outlined">
        Create package
      </M.Button>
    </>
  )
}
