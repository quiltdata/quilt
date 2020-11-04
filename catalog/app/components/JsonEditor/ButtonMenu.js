import * as React from 'react'
import cx from 'classnames'

import * as M from '@material-ui/core'

const useStyles = M.makeStyles((t) => ({
  root: {
    color: t.palette.divider,
    cursor: 'default',
    height: 'auto',
  },
  clickable: {
    cursor: 'pointer',
    '&:hover': {
      color: t.palette.text.primary,
    },
  },
  note: {
    fontFamily: t.typography.monospace.fontFamily,
    fontSize: t.typography.caption.fontSize,
    marginRight: t.spacing(0.5),
  },
}))

function ButtonMenu({ className, hasMenu, note, onClick }, ref) {
  const classes = useStyles()

  const onClickInternal = React.useCallback(
    (event) => {
      if (!hasMenu) return
      onClick(event)
    },
    [hasMenu, onClick],
  )

  return (
    <M.InputAdornment
      className={cx(classes.root, { [classes.clickable]: hasMenu }, className)}
      onClick={onClickInternal}
    >
      <code className={classes.note} ref={ref}>
        {note}
      </code>

      {hasMenu && <M.Icon fontSize="small">arrow_drop_down</M.Icon>}
    </M.InputAdornment>
  )
}

export default React.forwardRef(ButtonMenu)
