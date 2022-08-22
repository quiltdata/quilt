import * as React from 'react'
import * as M from '@material-ui/core'

import * as AddToPackage from 'containers/AddToPackage'
import { usePackageCreationDialog } from 'containers/Bucket/PackageDialog/PackageCreationForm'
import type * as Model from 'model'
import * as s3paths from 'utils/s3paths'

import * as requests from '../requests'

type ManifestKey = 'hash' | 'logical_key' | 'meta' | 'physical_keys' | 'size'
type ManifestEntryStringified = Record<ManifestKey, string>

function areQueryResultsContainMainefstEntries(
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

function parseManifenstEntryStringified(entry: ManifestEntryStringified): {
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

function parseQueryResults(
  rows: [ManifestKey[], ...string[][]],
): Record<string, Model.S3File> {
  const [head, ...tail] = rows
  const manifestEntries: ManifestEntryStringified[] = tail.reduce(
    (memo, row) => memo.concat(rowToManifestEntryStringified(row, head)),
    [] as ManifestEntryStringified[],
  )
  return manifestEntries.reduce(
    (memo, entry) => ({
      ...memo,
      ...parseManifenstEntryStringified(entry),
    }),
    {},
  )
}

interface CreatePackageProps {
  bucket: string
  rows: requests.athena.QueryResultsRows
}

export default function CreatePackage({ bucket, rows }: CreatePackageProps) {
  const addToPackage = AddToPackage.use()
  const createDialog = usePackageCreationDialog({
    bucket,
    delayHashing: true,
    disableStateDisplay: true,
  })
  const onPackage = React.useCallback(() => {
    if (!areQueryResultsContainMainefstEntries(rows)) return

    const entries = parseQueryResults(rows)
    addToPackage?.merge(entries)
    createDialog.open()
  }, [addToPackage, createDialog, rows])

  if (!areQueryResultsContainMainefstEntries(rows)) return null

  return (
    <>
      {createDialog.render({
        successTitle: 'Package created',
        successRenderMessage: ({ packageLink }) => (
          <>Package {packageLink} successfully created</>
        ),
        title: 'Create package',
      })}
      <M.Button color="primary" onClick={onPackage} variant="outlined" size="small">
        Create package
      </M.Button>
    </>
  )
}
