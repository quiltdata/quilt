import cx from 'classnames'
import * as React from 'react'
import { fade } from '@material-ui/core/styles'
import * as M from '@material-ui/core'

import * as style from 'constants/style'

const useStyles = M.makeStyles({
  root: {
    // Navy surface like the header. Children render inside the nav theme below,
    // so their MUI styles pick up the dark palette (light text/icons/dividers).
    background: style.navTheme.palette.secondary.dark,
    borderRight: `1px solid ${fade('#fff', 0.12)}`,
    color: style.navTheme.palette.common.white,
    display: 'flex',
    flexDirection: 'column',
    flexShrink: 0,
    minHeight: 0,
    // Stay above absolutely-positioned page backgrounds (e.g. the landing Dots),
    // otherwise the rail isn't clickable on the home page.
    position: 'relative',
    zIndex: 1,
  },
})

interface RailProps {
  className?: string
  children: React.ReactNode
}

export function Rail({ className, children }: RailProps) {
  const classes = useStyles()
  return (
    <M.MuiThemeProvider theme={style.navTheme}>
      <nav className={cx(classes.root, className)}>{children}</nav>
    </M.MuiThemeProvider>
  )
}
