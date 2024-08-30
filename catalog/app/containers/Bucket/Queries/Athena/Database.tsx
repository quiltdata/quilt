import cx from 'classnames'
import * as React from 'react'
import * as M from '@material-ui/core'
import * as Lab from '@material-ui/lab'

import Skeleton from 'components/Skeleton'
import * as Dialogs from 'utils/GlobalDialogs'

import * as requests from '../requests'

interface SelectErrorProps {
  className?: string
  error: Error
}

function SelectError({ className, error }: SelectErrorProps) {
  const openDialog = Dialogs.use()
  const handleClick = React.useCallback(() => {
    openDialog(() => (
      <M.Box p={2}>
        <M.Typography>{error.message}</M.Typography>
      </M.Box>
    ))
  }, [error.message, openDialog])
  return (
    <Lab.Alert
      action={
        <M.Button onClick={handleClick} size="small" color="inherit">
          Show more
        </M.Button>
      }
      className={className}
      severity="error"
    >
      {error.name}
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
  className?: string
  data: Response
  label: string
  onChange: (value: string) => void
  onLoadMore: (prev: Response) => void
  value: string | null
  disabled?: boolean
}

function Select({
  className,
  data,
  disabled,
  label,
  onChange,
  onLoadMore,
  value,
}: SelectProps) {
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
    <M.FormControl className={cx(classes.root, className)} disabled={disabled}>
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
  className?: string
  value: requests.athena.CatalogName | null
  onChange: (catalogName: requests.athena.CatalogName) => void
}

function SelectCatalogName({ className, value, onChange }: SelectCatalogNameProps) {
  const [prev, setPrev] = React.useState<requests.athena.CatalogNamesResponse | null>(
    null,
  )
  const data = requests.athena.useCatalogNames(prev)
  return data.case({
    Ok: (response) => (
      <Select
        className={className}
        data={response}
        label="Data catalog"
        onChange={onChange}
        onLoadMore={setPrev}
        value={value}
      />
    ),
    Err: (error) => <SelectError className={className} error={error} />,
    _: () => <SelectSkeleton />,
  })
}

interface SelectDatabaseProps
  extends Omit<SelectProps, 'data' | 'label' | 'onChange' | 'onLoadMore'> {
  catalogName: requests.athena.CatalogName | null
  onChange: (database: requests.athena.Database) => void
  value: requests.athena.Database | null
}

function SelectDatabase({ catalogName, onChange, ...rest }: SelectDatabaseProps) {
  const [prev, setPrev] = React.useState<requests.athena.DatabasesResponse | null>(null)
  const data = requests.athena.useDatabases(catalogName, prev)
  return data.case({
    Ok: (response) => (
      <Select
        {...rest}
        data={response}
        label="Database"
        onChange={onChange}
        onLoadMore={setPrev}
      />
    ),
    Err: (error) => <SelectError className={rest.className} error={error} />,
    _: () => <SelectSkeleton />,
  })
}

const useStyles = M.makeStyles((t) => ({
  root: {
    alignItems: 'center',
    display: 'flex',
  },
  field: {
    cursor: 'pointer',
    marginRight: t.spacing(2),
    width: '50%',
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

interface DatabaseProps {
  className?: string
  value: requests.athena.ExecutionContext | null
  onChange: (value: requests.athena.ExecutionContext | null) => void
}

export default function Database({ className, value, onChange }: DatabaseProps) {
  const classes = useStyles()
  const [catalogName, setCatalogName] =
    React.useState<requests.athena.CatalogName | null>(value?.catalogName || null)
  const handleCatalogName = React.useCallback(
    (name) => {
      setCatalogName(name)
      onChange(null)
    },
    [onChange],
  )
  const handleDatabase = React.useCallback(
    (database) => {
      if (!catalogName) return
      onChange({ catalogName, database })
    },
    [catalogName, onChange],
  )
  return (
    <div className={cx(classes.root, className)}>
      <SelectCatalogName
        className={classes.field}
        onChange={handleCatalogName}
        value={catalogName}
      />
      <SelectDatabase
        className={classes.field}
        catalogName={catalogName}
        onChange={handleDatabase}
        value={value?.database || null}
        disabled={!catalogName}
      />
    </div>
  )
}
