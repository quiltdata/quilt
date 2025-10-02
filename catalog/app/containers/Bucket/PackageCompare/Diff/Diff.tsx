import cx from 'classnames'
import * as React from 'react'
import * as M from '@material-ui/core'

import assertNever from 'utils/assertNever'

export type Dir = 'ltr' | 'rtl'

export type Side = 'left' | 'right'

const useStyles = M.makeStyles((t) => ({
  root: {
    borderRadius: '2px',
    padding: '0 2px',
  },
  added: {
    backgroundColor: M.fade(t.palette.success.light, 0.3),
  },
  removed: {
    textDecoration: 'line-through',
    backgroundColor: M.fade(t.palette.error.light, 0.3),
  },
}))

function useClassName(side: Side, dir: Dir) {
  const { added, removed } = useStyles()
  return React.useMemo(() => {
    switch (side) {
      case 'left':
        switch (dir) {
          case 'ltr':
            return added
          case 'rtl':
            return removed
          default:
            assertNever(dir)
        }
      case 'right':
        switch (dir) {
          case 'ltr':
            return removed
          case 'rtl':
            return added
          default:
            assertNever(dir)
        }
      default:
        assertNever(side)
    }
  }, [side, dir, added, removed])
}

interface ChangeProps {
  className?: string
  dir: Dir
  children: React.ReactNode
  side: Side
}

export default function Change({ className, dir, children, side }: ChangeProps) {
  const classes = useStyles()
  const modified = useClassName(side, dir)
  return <span className={cx(classes.root, modified, className)}>{children}</span>
}
