import cx from 'classnames'
import * as React from 'react'
import { fade } from '@material-ui/core/styles'
import * as M from '@material-ui/core'

import * as style from 'constants/style'

const useStyles = M.makeStyles((t) => ({
  root: {
    // Midnight surface like the header/footer. Children render inside the nav
    // theme below, so their MUI styles pick up the dark palette (light
    // text/icons/dividers).
    background: style.navTheme.palette.background.default,
    borderRight: `1px solid ${fade('#fff', 0.12)}`,
    color: style.navTheme.palette.text.primary,
    display: 'flex',
    flexDirection: 'column',
    flexShrink: 0,
    minHeight: 0,
    // Stay above the header AppBar (and absolutely-positioned page backgrounds
    // like the landing Dots), otherwise the rail isn't clickable on the home page.
    position: 'relative',
    zIndex: t.zIndex.appBar + 1,
  },
}))

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
