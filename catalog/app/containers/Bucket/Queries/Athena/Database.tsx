import cx from 'classnames'
import * as React from 'react'
import * as M from '@material-ui/core'
import * as Lab from '@material-ui/lab'

import Skeleton from 'components/Skeleton'

import * as requests from '../requests'

interface SelectErrorProps {
  error: Error
}

function SelectError({ error }: SelectErrorProps) {
  return (
    <Lab.Alert severity="error">
      <Lab.AlertTitle>{error.name}</Lab.AlertTitle>
      {error.message}
    </Lab.Alert>
  )
}

function SelectSkeleton() {
  return <Skeleton height={32} animate />
}

const LOAD_MORE = '__load-more__'

interface Response {
  list: string[]
  next?: string
}

const useSelectStyles = M.makeStyles({
  root: {
    width: '100%',
  },
})

interface SelectProps {
  data: Response
  label: string
  onChange: (value: string) => void
  onLoadMore: (prev: Response) => void
}

function Select({ data, label, onChange, onLoadMore }: SelectProps) {
  const classes = useSelectStyles()
  const handleChange = React.useCallback(
    (event) => {
      const { value } = event.target
      if (value === LOAD_MORE) {
        onLoadMore(data)
      } else {
        onChange(value)
      }
    },
    [data, onLoadMore, onChange],
  )

  return (
    <M.FormControl className={classes.root}>
      <M.InputLabel>{label}</M.InputLabel>
      <M.Select onChange={handleChange}>
        {data.list.map((value) => (
          <M.MenuItem value={value}>{value}</M.MenuItem>
        ))}
        {data.next && <M.MenuItem value={LOAD_MORE}>Load more</M.MenuItem>}
      </M.Select>
    </M.FormControl>
  )
}

interface SelectCatalogNameProps {
  onChange: (catalogName: string) => void
}

function SelectCatalogName({ onChange }: SelectCatalogNameProps) {
  const [prev, setPrev] = React.useState<requests.athena.CatalogNamesResponse | null>(
    null,
  )
  const data = requests.athena.useCatalogNames(prev)
  return data.case({
    Ok: (response) => (
      <Select
        data={response}
        label="Data catalog"
        onChange={onChange}
        onLoadMore={setPrev}
      />
    ),
    Err: (error) => <SelectError error={error} />,
    _: () => <SelectSkeleton />,
  })
}

interface SelectDatabaseProps {
  catalogName: requests.athena.CatalogName | null
  onChange: (database: requests.athena.Database) => void
}

function SelectDatabase({ catalogName, onChange }: SelectDatabaseProps) {
  const [prev, setPrev] = React.useState<requests.athena.DatabasesResponse | null>(null)
  const data = requests.athena.useDatabases(catalogName, prev)
  return data.case({
    Ok: (response) => (
      <Select data={response} label="Database" onChange={onChange} onLoadMore={setPrev} />
    ),
    Err: (error) => <SelectError error={error} />,
    _: () => <SelectSkeleton />,
  })
}

const useDialogStyles = M.makeStyles((t) => ({
  select: {
    width: '100%',
    '& + &': {
      marginTop: t.spacing(2),
    },
  },
}))

interface DialogProps {
  open: boolean
  onClose: () => void
  onChange: (value: requests.athena.Database) => void
}

function Dialog({ open, onChange, onClose }: DialogProps) {
  const classes = useDialogStyles()
  const [catalogName, setCatalogName] =
    React.useState<requests.athena.CatalogName | null>(null)
  return (
    <M.Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <M.DialogTitle>Select data catalog and database</M.DialogTitle>
      <M.DialogContent>
        <div className={classes.select}>
          <SelectCatalogName onChange={setCatalogName} />
        </div>
        {catalogName && (
          <div className={classes.select}>
            <SelectDatabase catalogName={catalogName} onChange={onChange} />
          </div>
        )}
      </M.DialogContent>
      <M.DialogActions>
        <M.Button color="primary" variant="outlined" onClick={onClose}>
          Cancel
        </M.Button>
        <M.Button color="primary" variant="contained" onClick={onClose}>
          Submit
        </M.Button>
      </M.DialogActions>
    </M.Dialog>
  )
}

const useChangeButtonStyles = M.makeStyles((t) => ({
  root: {
    alignItems: 'center',
    display: 'flex',
  },
  button: {
    marginLeft: t.spacing(1),
  },
}))

interface ChangeButtonProps {
  className?: string
  database: requests.athena.Database | null
  onClick: () => void
}

function ChangeButton({ className, database, onClick }: ChangeButtonProps) {
  const classes = useChangeButtonStyles()
  return (
    <M.Typography className={cx(classes.root, className)} variant="body2">
      Use {database ? <strong>{database}</strong> : 'default'} database or
      <M.Button
        className={classes.button}
        color="primary"
        onClick={onClick}
        size="small"
        variant="outlined"
      >
        {database ? 'change' : 'set'} database
      </M.Button>
    </M.Typography>
  )
}

interface DatabaseProps {
  className?: string
  value: requests.athena.Database | null
  onChange: (value: string) => void
}

export default function Database({ className, value, onChange }: DatabaseProps) {
  const [open, setOpen] = React.useState(false)
  return (
    <>
      <Dialog open={open} onChange={onChange} onClose={() => setOpen(false)} />
      <ChangeButton
        className={className}
        database={value}
        onClick={() => setOpen(true)}
      />
    </>
  )
}
