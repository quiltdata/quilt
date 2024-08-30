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
  value: string | null
}

function Select({ data, label, onChange, onLoadMore, value }: SelectProps) {
  const classes = useSelectStyles()
  const handleChange = React.useCallback(
    (event) => {
      if (event.target.value === LOAD_MORE) {
        onLoadMore(data)
      } else {
        onChange(event.target.value)
      }
    },
    [data, onLoadMore, onChange],
  )

  return (
    <M.FormControl className={classes.root}>
      <M.InputLabel>{label}</M.InputLabel>
      <M.Select onChange={handleChange} value={value?.toLowerCase()}>
        {data.list.map((item) => (
          <M.MenuItem key={item} value={item.toLowerCase()}>
            {item}
          </M.MenuItem>
        ))}
        {data.next && <M.MenuItem value={LOAD_MORE}>Load more</M.MenuItem>}
      </M.Select>
    </M.FormControl>
  )
}

interface SelectCatalogNameProps {
  value: requests.athena.CatalogName | null
  onChange: (catalogName: requests.athena.CatalogName) => void
}

function SelectCatalogName({ value, onChange }: SelectCatalogNameProps) {
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
        value={value}
      />
    ),
    Err: (error) => <SelectError error={error} />,
    _: () => <SelectSkeleton />,
  })
}

interface SelectDatabaseProps {
  catalogName: requests.athena.CatalogName | null
  onChange: (database: requests.athena.Database) => void
  value: requests.athena.Database | null
}

function SelectDatabase({ catalogName, onChange, value }: SelectDatabaseProps) {
  const [prev, setPrev] = React.useState<requests.athena.DatabasesResponse | null>(null)
  const data = requests.athena.useDatabases(catalogName, prev)
  return data.case({
    Ok: (response) => (
      <Select
        data={response}
        label="Database"
        onChange={onChange}
        onLoadMore={setPrev}
        value={value}
      />
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
  initialValue: requests.athena.ExecutionContext | null
  onChange: (value: requests.athena.ExecutionContext) => void
  onClose: () => void
  open: boolean
}

function Dialog({ initialValue, open, onChange, onClose }: DialogProps) {
  const classes = useDialogStyles()
  const [catalogName, setCatalogName] =
    React.useState<requests.athena.CatalogName | null>(initialValue?.catalogName || null)
  const [database, setDatabase] = React.useState<requests.athena.Database | null>(
    initialValue?.database || null,
  )
  const handleSubmit = React.useCallback(() => {
    if (!catalogName || !database) return
    onChange({ catalogName, database })
    onClose()
  }, [catalogName, database, onChange, onClose])
  return (
    <M.Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <M.DialogTitle>Select data catalog and database</M.DialogTitle>
      <M.DialogContent>
        <div className={classes.select}>
          <SelectCatalogName onChange={setCatalogName} value={catalogName} />
        </div>
        {catalogName && (
          <div className={classes.select}>
            <SelectDatabase
              catalogName={catalogName}
              onChange={setDatabase}
              value={database}
            />
          </div>
        )}
      </M.DialogContent>
      <M.DialogActions>
        <M.Button color="primary" variant="outlined" onClick={onClose}>
          Cancel
        </M.Button>
        <M.Button
          color="primary"
          disabled={!catalogName || !database}
          onClick={handleSubmit}
          variant="contained"
        >
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
  field: {
    cursor: 'pointer',
    flexGrow: 1,
    marginRight: t.spacing(2),
    '& input': {
      cursor: 'pointer',
    },
    '& > *': {
      cursor: 'pointer',
    },
  },
  button: {
    marginLeft: t.spacing(1),
  },
}))

interface ChangeButtonProps {
  className?: string
  executionContext: requests.athena.ExecutionContext | null
  onClick: () => void
}

function ChangeButton({ className, executionContext, onClick }: ChangeButtonProps) {
  const classes = useChangeButtonStyles()
  const handleClick = React.useCallback(
    (event) => {
      event.target.blur()
      onClick()
    },
    [onClick],
  )
  return (
    <div className={cx(classes.root, className)}>
      {executionContext ? (
        <>
          <M.TextField
            className={classes.field}
            defaultValue={executionContext.catalogName}
            label="Data catalog"
            onClick={handleClick}
            size="small"
          />
          <M.TextField
            className={classes.field}
            defaultValue={executionContext.database}
            label="Database"
            onClick={handleClick}
            size="small"
          />
        </>
      ) : (
        <M.Button
          className={classes.button}
          color="primary"
          onClick={onClick}
          size="small"
          variant="outlined"
        >
          Set database and data catalog
        </M.Button>
      )}
    </div>
  )
}

interface DatabaseProps {
  className?: string
  value: requests.athena.ExecutionContext | null
  onChange: (value: requests.athena.ExecutionContext) => void
}

export default function Database({ className, value, onChange }: DatabaseProps) {
  const [open, setOpen] = React.useState(false)
  return (
    <>
      <Dialog
        initialValue={value}
        onChange={onChange}
        onClose={() => setOpen(false)}
        open={open}
      />
      <ChangeButton
        className={className}
        executionContext={value}
        onClick={() => setOpen(true)}
      />
    </>
  )
}
