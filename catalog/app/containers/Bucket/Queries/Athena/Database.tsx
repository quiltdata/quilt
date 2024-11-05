import cx from 'classnames'
import * as React from 'react'
import * as M from '@material-ui/core'
import * as Lab from '@material-ui/lab'

import Skeleton from 'components/Skeleton'
import * as Dialogs from 'utils/GlobalDialogs'

import * as Model from './model'

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
      <M.Select
        onChange={handleChange}
        value={value?.toLowerCase()}
        disabled={disabled || !data.list.length}
      >
        {data.list.map((item) => (
          <M.MenuItem key={item} value={item.toLowerCase()}>
            {item}
          </M.MenuItem>
        ))}
        {data.next && <M.MenuItem value={LOAD_MORE}>Load more</M.MenuItem>}
        {!data.list.length && (
          <M.MenuItem value={value?.toLowerCase() || undefined}>
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
  const { catalogName, catalogNames, running } = Model.use()
  if (Model.isError(catalogNames.data)) {
    return <SelectError className={className} error={catalogNames.data} />
  }
  if (Model.isError(catalogName.value)) {
    return <SelectError className={className} error={catalogName.value} />
  }
  if (!Model.hasValue(catalogName.value) || !Model.hasData(catalogNames.data)) {
    return <Skeleton className={className} height={32} animate />
  }

  return (
    <Select
      className={className}
      data={catalogNames.data}
      disabled={running}
      label="Data catalog"
      onChange={catalogName.setValue}
      onLoadMore={catalogNames.loadMore}
      value={catalogName.value}
    />
  )
}

interface SelectDatabaseProps {
  className: string
}

function SelectDatabase({ className }: SelectDatabaseProps) {
  const { catalogName, database, databases, running } = Model.use()
  if (Model.isError(databases.data)) {
    return <SelectError className={className} error={databases.data} />
  }
  if (Model.isError(database.value)) {
    return <SelectError className={className} error={database.value} />
  }
  if (!Model.hasValue(database.value) || !Model.hasData(databases.data)) {
    return <Skeleton className={className} height={32} animate />
  }

  return (
    <Select
      data={databases.data}
      disabled={!Model.hasValue(catalogName) || running}
      label="Database"
      onChange={database.setValue}
      onLoadMore={databases.loadMore}
      value={database.value}
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
