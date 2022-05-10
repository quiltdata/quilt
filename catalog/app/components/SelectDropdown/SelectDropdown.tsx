import cx from 'classnames'
import * as React from 'react'
import * as M from '@material-ui/core'

const useStyles = M.makeStyles((t) => ({
  root: {
    display: 'inline-flex',
    [t.breakpoints.down('sm')]: {
      borderRadius: 0,
      boxShadow: 'none',
    },
  },
  button: {
    ...t.typography.body1,
    textTransform: 'none',
  },
  disabled: {
    cursor: 'not-allowed',
  },
  progress: {
    margin: t.spacing(0, 1),
  },
}))

export interface ValueBase {
  // TODO: use getOptionLabel(): string  similar to M.Autocomplete
  toString: () => string
  // TODO: use isOptionEqualToValue(): bool similar to M.Autocomplete
  valueOf: () => string | number | boolean
}

interface SelectDropdownProps<Value extends ValueBase> {
  ButtonProps?: M.ButtonProps
  children?: React.ReactNode
  disabled?: boolean
  emptySlot?: React.ReactNode
  loading?: boolean
  onChange: (selected: Value) => void
  onClose?: () => void
  onOpen?: () => void
  options: Value[]
  value: ValueBase
}

export default function SelectDropdown<Value extends ValueBase>({
  ButtonProps,
  children,
  className,
  disabled = false,
  emptySlot,
  loading,
  onChange,
  onClose,
  onOpen,
  options,
  value,
  ...props
}: M.PaperProps & SelectDropdownProps<Value>) {
  const classes = useStyles()

  const [anchorEl, setAnchorEl] = React.useState<HTMLElement | null>(null)

  const handleOpen = React.useCallback(
    (event) => {
      if (disabled) return
      if (onOpen) onOpen()
      setAnchorEl(event.currentTarget)
    },
    [disabled, onOpen, setAnchorEl],
  )

  const handleClose = React.useCallback(() => {
    if (onClose) onClose()
    setAnchorEl(null)
  }, [onClose])

  const handleSelect = React.useCallback(
    (selected: Value) => () => {
      setAnchorEl(null)
      onChange(selected)
    },
    [onChange],
  )

  const t = M.useTheme()
  const aboveSm = M.useMediaQuery(t.breakpoints.up('sm'))
  const { className: buttonClassName, ...buttonProps } = ButtonProps || {}

  return (
    <M.Paper
      className={cx(className, classes.root, { [classes.disabled]: disabled })}
      elevation={0}
      {...props}
    >
      <M.Button
        className={cx(classes.button, buttonClassName)}
        onClick={handleOpen}
        size="small"
        variant="outlined"
        disabled={disabled}
        {...buttonProps}
      >
        {children}
        {aboveSm && (
          <>
            {value.toString()}
            {loading && (
              <M.CircularProgress
                className={classes.progress}
                color="inherit"
                size={16}
              />
            )}
            <M.Icon fontSize="inherit">expand_more</M.Icon>
          </>
        )}
      </M.Button>

      <M.Menu
        anchorEl={anchorEl}
        open={!!anchorEl && !loading}
        onClose={handleClose}
        MenuListProps={{ dense: true }}
      >
        {options.length
          ? options.map((item) => (
              <M.MenuItem
                key={item.toString()}
                onClick={handleSelect(item)}
                selected={value.valueOf() === item.valueOf()}
              >
                <M.ListItemText primary={item.toString()} />
              </M.MenuItem>
            ))
          : emptySlot}
      </M.Menu>
    </M.Paper>
  )
}
