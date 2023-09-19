import cx from 'classnames'
import * as React from 'react'
import * as M from '@material-ui/core'

const useStyles = M.makeStyles((t) => ({
  root: {
    display: 'flex',
    flexDirection: 'column',
    maxHeight: t.spacing(40),
  },
  scrollArea: {
    flexGrow: 1,
    overflow: 'hidden auto',
  },
  hidden: {
    marginTop: t.spacing(1),
  },
  empty: {
    marginTop: t.spacing(2),
  },
  label: {
    cursor: 'pointer',
    display: 'block',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  checkboxWrapper: {
    minWidth: t.spacing(4),
    paddingLeft: '2px',
  },
}))

interface ListProps {
  className?: string
  extents: string[]
  onChange: (v: string[]) => void
  placeholder?: string
  value: string[]
}

export default function List({
  className,
  extents,
  onChange,
  placeholder,
  value,
}: ListProps) {
  const [filter, setFilter] = React.useState('')
  const classes = useStyles()
  const valueMap = value.reduce(
    (memo, v) => ({ ...memo, [v]: true }),
    {} as Record<string, boolean>,
  )
  const filteredExtents = React.useMemo(
    () =>
      !filter
        ? extents
        : extents.filter(
            (extent) => extent.toLowerCase().indexOf(filter.toLowerCase()) > -1,
          ),
    [filter, extents],
  )
  const handleChange = React.useCallback(
    (extent, checked) => {
      const newValue = checked ? [...value, extent] : value.filter((v) => v !== extent)
      onChange(newValue)
    },
    [onChange, value],
  )
  const hiddenNumber = extents.length - filteredExtents.length
  return (
    <div className={cx(classes.root, className)}>
      <M.TextField
        onChange={(event) => setFilter(event.target.value)}
        placeholder={placeholder}
        size="small"
        value={filter}
        variant="outlined"
        InputProps={{
          endAdornment: filter && (
            <M.InputAdornment position="end">
              <M.IconButton size="small" onClick={() => setFilter('')}>
                <M.Icon fontSize="inherit">close</M.Icon>
              </M.IconButton>
            </M.InputAdornment>
          ),
        }}
      />
      <div className={classes.scrollArea}>
        <M.List dense>
          {filteredExtents.map((extent) => (
            <M.ListItem key={extent} disableGutters>
              <M.ListItemIcon className={classes.checkboxWrapper}>
                <M.Checkbox
                  edge="start"
                  checked={!!valueMap[extent]}
                  id={`list_${extent}`}
                  onChange={(event, checked) => handleChange(extent, checked)}
                  size="small"
                />
              </M.ListItemIcon>
              <M.ListItemText>
                <label
                  className={classes.label}
                  htmlFor={`list_${extent}`}
                  title={extent}
                >
                  {extent}
                </label>
              </M.ListItemText>
            </M.ListItem>
          ))}
          {!!hiddenNumber &&
            (hiddenNumber === extents.length ? (
              <M.Typography className={classes.empty} variant="body1">
                Clear filter to see {hiddenNumber} items that do not fit the filter string
              </M.Typography>
            ) : (
              <M.Typography className={classes.hidden} variant="caption">
                {hiddenNumber} items do not fit the filter string
              </M.Typography>
            ))}
        </M.List>
      </div>
    </div>
  )
}
