import cx from 'classnames'
import * as React from 'react'
import { fade } from '@material-ui/core/styles'
import * as M from '@material-ui/core'

const useStyles = M.makeStyles((t) => ({
  root: {
    // The rail wears the app primary (ratified midnight). Children render
    // under the ambient app theme; nav-specific text/indicator colors come
    // from the palette.navigation token slice (see constants/style.js).
    background: t.palette.primary.main,
    borderRight: `1px solid ${fade('#fff', 0.12)}`,
    color: t.palette.navigation.text,
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
  return <nav className={cx(classes.root, className)}>{children}</nav>
}
