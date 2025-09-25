import * as React from 'react'
import * as M from '@material-ui/core'

import * as Dialog from 'components/Dialog'
import * as AddToPackage from 'containers/AddToPackage'
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
  queryResults: requests.QueryResults
}

export default function CreatePackage({ queryResults }: CreatePackageProps) {
  const classes = useStyles()
  const [entries, setEntries] = React.useState<ParsedRows>({ valid: {}, invalid: [] })
  const addToPackage = AddToPackage.use()
  const createDialog = useCreateDialog({
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

    const parsed = parseQueryResults(queryResults)
    setEntries(parsed)
    if (parsed.invalid.length) {
      confirm.open()
    } else {
      addToPackage?.merge(parsed.valid)
      createDialog.open()
    }
  }, [addToPackage, confirm, createDialog, queryResults])

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
