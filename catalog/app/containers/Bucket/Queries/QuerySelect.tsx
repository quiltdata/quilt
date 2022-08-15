import * as React from 'react'
import * as M from '@material-ui/core'

interface AbstractQuery {
  key: string
  name: string
  description?: string
}

interface QuerySelectProps<T> {
  onChange: (value: T | null) => void
  onLoadMore?: () => void
  queries: T[]
  value: T | null
}

const useStyles = M.makeStyles((t) => ({
  header: {
    margin: t.spacing(0, 0, 1),
  },
  selectWrapper: {
    width: '100%',
  },
  select: {
    padding: t.spacing(1),
  },
}))

const LOAD_MORE = 'load-more'

export default function QuerySelect<T>({
  queries,
  onChange,
  onLoadMore,
  value,
}: QuerySelectProps<T & AbstractQuery>) {
  const classes = useStyles()

  const handleChange = React.useCallback(
    (event) => {
      if (event.target.value === LOAD_MORE && onLoadMore) {
        onLoadMore()
      } else {
        onChange(queries.find((query) => query.key === event.target.value) || null)
      }
    },
    [queries, onChange, onLoadMore],
  )

  return (
    <M.Paper>
      <M.FormControl className={classes.selectWrapper}>
        <M.Select
          classes={{ root: classes.select }}
          disabled={!queries.length}
          onChange={handleChange}
          value={value ? value.key : 'none'}
        >
          <M.MenuItem disabled value="none">
            <M.ListItemText>Custom</M.ListItemText>
          </M.MenuItem>
          {queries.map((query) => (
            <M.MenuItem key={query.key} value={query.key}>
              <M.ListItemText primary={query.name} secondary={query.description} />
            </M.MenuItem>
          ))}
          {!!onLoadMore && (
            <M.MenuItem key={LOAD_MORE} value={LOAD_MORE}>
              <M.ListItemText>
                <em>Load more</em>
              </M.ListItemText>
            </M.MenuItem>
          )}
        </M.Select>
      </M.FormControl>
    </M.Paper>
  )
}
