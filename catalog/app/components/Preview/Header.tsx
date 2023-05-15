import cx from 'classnames'
import * as React from 'react'
import * as M from '@material-ui/core'

import * as Buttons from 'components/Buttons'
import type * as Model from 'model'

import Menu from './Menu'

const useStyles = M.makeStyles((t) => ({
  heading: {
    ...t.typography.h6,
    alignItems: 'flex-start',
    display: 'flex',
    lineHeight: 1.75,
    [t.breakpoints.up('md')]: {
      ...t.typography.h5,
    },
  },
  headingText: {
    flexGrow: 1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  actions: {
    display: 'flex',
    flexShrink: 0,
    marginLeft: t.spacing(2),
    marginTop: '2px',
  },
  menu: {
    display: 'flex',
    marginLeft: t.spacing(1),
  },
}))

interface HeaderProps {
  children: React.ReactNode
  className?: string
  downloadable?: boolean
  expanded?: boolean
  handle?: Model.S3.S3ObjectLocation
  onToggle?: () => void
}

export default function Header({
  downloadable = false,
  expanded = false,
  handle,
  children,
  onToggle,
  className,
}: HeaderProps) {
  const classes = useStyles()
  return (
    <div className={cx(classes.heading, className)}>
      <div className={classes.headingText}>{children}</div>
      <div className={classes.actions}>
        {onToggle && (
          <Buttons.Iconized
            label={expanded ? 'Collapse' : 'Expand'}
            icon={expanded ? 'unfold_less' : 'unfold_more'}
            rotate={expanded}
            onClick={onToggle}
          />
        )}
        {downloadable && !!handle && <Menu className={classes.menu} handle={handle} />}
      </div>
    </div>
  )
}
