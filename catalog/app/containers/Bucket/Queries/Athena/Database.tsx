import cx from 'classnames'
import * as React from 'react'
import * as M from '@material-ui/core'
import * as Lab from '@material-ui/lab'

import Skeleton from 'components/Skeleton'
import * as Dialogs from 'utils/GlobalDialogs'

import * as Model from './model'
import * as storage from './model/storage'

const useSelectErrorStyles = M.makeStyles((t) => ({
  button: {
    whiteSpace: 'nowrap',
  },
  dialog: {
    padding: t.spacing(2),
  },
}))

interface SelectErrorProps {
  className?: string
  error: Error
}

function SelectError({ className, error }: SelectErrorProps) {
  const classes = useSelectErrorStyles()
  const openDialog = Dialogs.use()
  const handleClick = React.useCallback(() => {
    openDialog(() => (
      <div className={classes.dialog}>
        <M.Typography>{error.message}</M.Typography>
      </div>
    ))
  }, [classes.dialog, error.message, openDialog])
  return (
    <Lab.Alert
      action={
        <M.Button
          className={classes.button}
          color="inherit"
          onClick={handleClick}
          size="small"
        >
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

const EMPTY = '__empty__'

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
      <M.Select
        onChange={handleChange}
        value={data.list.length ? value?.toLowerCase() || '' : EMPTY}
        disabled={disabled || !data.list.length}
      >
        {data.list.map((item) => (
          <M.MenuItem key={item} value={item.toLowerCase()}>
            {item}
          </M.MenuItem>
        ))}
        {data.next && <M.MenuItem value={LOAD_MORE}>Load more</M.MenuItem>}
        {!data.list.length && (
          <M.MenuItem value={value?.toLowerCase() || EMPTY}>
            {value || 'Empty list'}
          </M.MenuItem>
        )}
      </M.Select>
    </M.FormControl>
  )
}

interface SelectCatalogNameProps {
  className?: string
}

function SelectCatalogName({ className }: SelectCatalogNameProps) {
  const { catalogName, catalogNames, queryRun } = Model.use()

  const handleChange = React.useCallback(
    (value) => {
      storage.setCatalog(value)
      storage.clearDatabase()
      catalogName.setValue(value)
    },
    [catalogName],
  )

  if (Model.isError(catalogNames.data)) {
    return <SelectError className={className} error={catalogNames.data.error} />
  }
  if (Model.isError(catalogName.value)) {
    return <SelectError className={className} error={catalogName.value.error} />
  }
  if (!Model.hasValue(catalogName.value) || !Model.hasData(catalogNames.data)) {
    return <Skeleton className={className} height={32} animate mt={2} />
  }

  return (
    <Select
      className={className}
      data={catalogNames.data.data}
      disabled={Model.isLoading(queryRun)}
      label="Data catalog"
      onChange={handleChange}
      onLoadMore={catalogNames.loadMore}
      value={catalogName.value.data}
    />
  )
}

interface SelectDatabaseProps {
  className: string
}

function SelectDatabase({ className }: SelectDatabaseProps) {
  const { catalogName, database, databases, queryRun } = Model.use()

  const handleChange = React.useCallback(
    (value) => {
      storage.setDatabase(value)
      database.setValue(value)
    },
    [database],
  )

  if (Model.isError(databases.data)) {
    return <SelectError className={className} error={databases.data.error} />
  }
  if (Model.isError(database.value)) {
    return <SelectError className={className} error={database.value.error} />
  }
  if (!Model.hasValue(database.value) || !Model.hasData(databases.data)) {
    return <Skeleton className={className} height={32} animate mt={2} />
  }

  return (
    <Select
      data={databases.data.data}
      disabled={!Model.hasValue(catalogName.value) || Model.isLoading(queryRun)}
      label="Database"
      onChange={handleChange}
      onLoadMore={databases.loadMore}
      value={database.value.data}
    />
  )
}

const useStyles = M.makeStyles((t) => ({
  root: {
    alignItems: 'center',
    display: 'flex',
  },
  field: {
    flexBasis: '50%',
    marginRight: t.spacing(2),
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
