import cx from 'classnames'
import * as React from 'react'
import * as M from '@material-ui/core'

const useStyles = M.makeStyles((t) => ({
  root: {
    color: t.palette.divider,
    cursor: 'default',
    height: 'auto',
  },
  actionable: {
    cursor: 'pointer',
    '&:hover': {
      color: t.palette.text.primary,
    },
  },
  note: {
    fontFamily: t.typography.monospace.fontFamily,
    fontSize: t.typography.caption.fontSize,
    marginLeft: t.spacing(0.5),
  },
}))

function CellMenuItem({ item, onClick }) {
  const onClickInternal = React.useCallback(() => onClick(item), [item, onClick])

  return (
    <M.MenuItem onClick={onClickInternal}>
      <M.ListItemText primary={item.title} />
    </M.MenuItem>
  )
}

function CellMenu({ anchorEl, menu, onClose, onClick }) {
  if (!menu.length) return null

  return (
    <M.Menu anchorEl={anchorEl} onClose={onClose} open>
      {menu.map((subList) => (
        <M.List
          subheader={
            subList.header && <M.ListSubheader>{subList.header}</M.ListSubheader>
          }
          key={subList.key}
        >
          {subList.options.map((item) => (
            <CellMenuItem
              key={`${item.action}_${item.title}`}
              item={item}
              onClick={onClick}
            />
          ))}
        </M.List>
      ))}
    </M.Menu>
  )
}

export default function ButtonMenu({
  className,
  menu,
  menuOpened,
  note,
  onClick,
  onMenuClose,
  onMenuSelect,
}) {
  const classes = useStyles()

  const ref = React.useRef(null)

  const hasMenu = React.useMemo(() => !!menu.length, [menu])

  const onClickInternal = React.useCallback(
    (event) => {
      if (!hasMenu) return
      onClick(event)
    },
    [hasMenu, onClick],
  )

  return (
    <M.InputAdornment className={cx(classes.root, className)}>
      {hasMenu && (
        <M.Icon className={classes.actionable} onClick={onClickInternal} fontSize="small">
          arrow_drop_down
        </M.Icon>
      )}

      <code className={classes.note} ref={ref}>
        {note}
      </code>

      {menuOpened && !!menu.length && (
        <CellMenu
          anchorEl={ref.current}
          menu={menu}
          onClick={onMenuSelect}
          onClose={onMenuClose}
        />
      )}
    </M.InputAdornment>
  )
}
