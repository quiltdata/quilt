import * as React from 'react'
import * as M from '@material-ui/core'

import * as Dialog from 'components/Dialog'
import useCreateDialog from 'containers/Bucket/PackageDialog/Create'

import type * as requests from './model/requests'
import {
  ParsedRows,
  doQueryResultsContainManifestEntries,
  parseQueryResults,
} from './model/createPackage'

import Results from './Results'

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
  queryResults: requests.QueryResults
}

export default function CreatePackage({ bucket, queryResults }: CreatePackageProps) {
  const classes = useStyles()
  const [entries, setEntries] = React.useState<ParsedRows>({ valid: {}, invalid: [] })
  const dst = React.useMemo(() => ({ bucket }), [bucket])
  const createDialog = useCreateDialog({
    delayHashing: true,
    disableStateDisplay: true,
    dst,
  })
  const handleConfirm = React.useCallback(
    (ok: boolean) => {
      if (!ok) return
      createDialog.open({ files: { _tag: 's3-files', value: entries.valid } })
    },
    [entries, createDialog],
  )
  const confirm = Dialog.useConfirm({
    title: 'These rows will be discarded. Confirm creating package?',
    onSubmit: handleConfirm,
  })
  const onPackage = React.useCallback(() => {
    if (!doQueryResultsContainManifestEntries(queryResults)) return

    const parsed = parseQueryResults(queryResults)
    setEntries(parsed)
    if (parsed.invalid.length) {
      confirm.open()
    } else {
      createDialog.open({ files: { _tag: 's3-files', value: parsed.valid } })
    }
  }, [confirm, createDialog, queryResults])

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
