import cx from 'classnames'
import * as React from 'react'
import * as M from '@material-ui/core'

const useStyles = M.makeStyles((t) => ({
  root: {
    display: 'inline-block',
    [t.breakpoints.down('sm')]: {
      borderRadius: 0,
      boxShadow: 'none',
    },
  },
  button: {
    ...t.typography.body1,
    border: 0,
    textTransform: 'none',
  },
  label: {
    marginLeft: t.spacing(1),
  },
}))

export interface ValueBase {
  toString: () => string
  valueOf: () => string | number | boolean
}

interface SelectDropdownProps<Value extends ValueBase> {
  children: React.ReactNode
  onChange: (selected: Value) => void
  options: Value[]
  value: Value
}

export default function SelectDropdown<Value extends ValueBase>({
  children,
  onChange,
  options,
  value,
  className,
  ...props
}: SelectDropdownProps<Value> & M.PaperProps) {
  const classes = useStyles()

  const [anchorEl, setAnchorEl] = React.useState<HTMLElement | null>(null)

  const handleOpen = React.useCallback((event) => setAnchorEl(event.currentTarget), [])

  const handleClose = React.useCallback(() => setAnchorEl(null), [])

  const handleSelect = React.useCallback(
    (selected: Value) => () => {
      setAnchorEl(null)
      onChange(selected)
    },
    [onChange],
  )

  const t = M.useTheme()
  const aboveSm = M.useMediaQuery(t.breakpoints.up('sm'))

  return (
    <M.Paper className={cx(className, classes.root)} {...props}>
      <M.Button
        className={classes.button}
        onClick={handleOpen}
        size="small"
        variant="outlined"
      >
        {children}
        {aboveSm && (
          <>
            <span className={classes.label}>{value.toString()}</span>
            <M.Icon fontSize="inherit">expand_more</M.Icon>
          </>
        )}
      </M.Button>

      <M.Menu
        anchorEl={anchorEl}
        open={!!anchorEl}
        onClose={handleClose}
        MenuListProps={{ dense: true }}
      >
        {options.map((item) => (
          <M.MenuItem
            key={item.toString()}
            onClick={handleSelect(item)}
            selected={value.valueOf() === item.valueOf()}
          >
            <M.ListItemText primary={item.toString()} />
          </M.MenuItem>
        ))}
      </M.Menu>
    </M.Paper>
  )
}
