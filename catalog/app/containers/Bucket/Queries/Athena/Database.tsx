import cx from 'classnames'
import * as React from 'react'
import * as M from '@material-ui/core'
import * as Lab from '@material-ui/lab'

import * as Model from 'model'
import Skeleton from 'components/Skeleton'
import * as Dialogs from 'utils/GlobalDialogs'

import * as State from './State'

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
}

function SelectCatalogName({ className }: SelectCatalogNameProps) {
  const { catalogName, setCatalogName, catalogNames, onCatalogNamesMore } = State.use()
  if (Model.isPending(catalogName) || Model.isPending(catalogNames)) {
    return <Skeleton className={className} height={32} animate />
  }
  if (Model.isError(catalogNames)) {
    return <SelectError className={className} error={catalogNames} />
  }
  if (Model.isError(catalogName)) {
    return <SelectError className={className} error={catalogName} />
  }

  return (
    <Select
      className={className}
      data={catalogNames}
      label="Data catalog"
      onChange={setCatalogName}
      onLoadMore={onCatalogNamesMore}
      value={catalogName}
    />
  )
}

interface SelectDatabaseProps {
  className: string
}

function SelectDatabase({ className }: SelectDatabaseProps) {
  const { catalogName, database, setDatabase, databases, onDatabasesMore } = State.use()
  if (Model.isError(databases)) {
    return <SelectError className={className} error={databases} />
  }
  if (Model.isError(database)) {
    return <SelectError className={className} error={database} />
  }
  if (Model.isPending(database) || Model.isPending(databases)) {
    return <Skeleton className={className} height={32} animate />
  }

  return (
    <Select
      data={databases}
      disabled={!Model.isFulfilled(catalogName)}
      label="Database"
      onChange={setDatabase}
      onLoadMore={onDatabasesMore}
      value={database}
    />
  )
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
}

export default function Database({ className }: DatabaseProps) {
  const classes = useStyles()
  return (
    <div className={cx(classes.root, className)}>
      <SelectCatalogName className={classes.field} />
      <SelectDatabase className={classes.field} />
    </div>
  )
}
