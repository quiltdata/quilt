import * as R from 'ramda'
import * as React from 'react'
import * as M from '@material-ui/core'

import SelectDropdown from 'components/SelectDropdown'
import * as CatalogSettings from 'utils/CatalogSettings'

const searchModes = [
  {
    toString: () => 'Objects & Packages',
    valueOf: () => null,
  },
  {
    toString: () => 'Objects',
    valueOf: () => 'objects',
  },
  {
    toString: () => 'Packages',
    valueOf: () => 'packages',
  },
]

const useStyles = M.makeStyles((t) => ({
  root: {},
  error: {
    margin: t.spacing(1, 0, 0),
    ...t.typography.body2,
    color: t.palette.error.main,
  },
}))

export default function SearchSettings() {
  const settings = CatalogSettings.use()
  const writeSettings = CatalogSettings.useWriteSettings()
  const classes = useStyles()

  const [value, setValue] = React.useState(
    () =>
      searchModes.find(({ valueOf }) => valueOf() === settings?.search?.mode) ||
      searchModes[0],
  )
  const [error, setError] = React.useState<Error | null>(null)
  const [loading, setLoading] = React.useState(false)

  const handleChange = React.useCallback(
    async (v) => {
      if (error) setError(null)

      setValue(v)
      setLoading(true)
      try {
        const initialSettings = settings || ({} as CatalogSettings.CatalogSettings)
        const updatedSettings = v.valueOf()
          ? R.assocPath(['search', 'mode'], v.valueOf(), initialSettings)
          : R.dissoc('search', initialSettings)
        await writeSettings(updatedSettings)
      } catch (e) {
        setError(e as Error)
      } finally {
        setLoading(false)
      }
    },
    [error, settings, writeSettings],
  )

  return (
    <div className={classes.root}>
      <SelectDropdown
        value={value}
        options={searchModes}
        onChange={handleChange}
        loading={loading}
        disabled={loading}
      />
      {error && <M.Typography className={classes.error}>{error.message}</M.Typography>}
    </div>
  )
}
