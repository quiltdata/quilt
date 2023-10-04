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
  root: {
    // compensates difference in height
    paddingBottom: '6px',
  },
  actions: {
    display: 'flex',
  },
  selectBtn: {
    textAlign: 'left',
    [t.breakpoints.up('sm')]: {
      minWidth: t.spacing(27),
    },
  },
  error: {
    margin: t.spacing(1, 0, 0),
    ...t.typography.body2,
    color: t.palette.error.main,
  },
  restore: {
    marginLeft: t.spacing(1),
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

  const handleReset = React.useCallback(
    () => handleChange(searchModes[0]),
    [handleChange],
  )

  return (
    <div className={classes.root}>
      <div className={classes.actions}>
        <SelectDropdown
          adaptive={false}
          value={value}
          options={searchModes}
          ButtonProps={{ className: classes.selectBtn }}
          onChange={handleChange}
          loading={loading}
          disabled={loading}
        />
        {value.valueOf() && (
          <M.IconButton
            className={classes.restore}
            size="small"
            onClick={handleReset}
            disabled={loading}
            title="Restore defaults"
          >
            <M.Icon>restore</M.Icon>
          </M.IconButton>
        )}
      </div>
      {!!error && <M.Typography className={classes.error}>{error.message}</M.Typography>}
    </div>
  )
}
