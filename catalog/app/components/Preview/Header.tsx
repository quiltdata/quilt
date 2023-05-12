import cx from 'classnames'
import * as React from 'react'
import * as M from '@material-ui/core'

import * as Buttons from 'components/Buttons'
import type * as Model from 'model'

import Menu from './Menu'

const useStyles = M.makeStyles((t) => ({
  heading: {
    ...t.typography.h6,
    display: 'flex',
    lineHeight: 1.75,
    alignItems: 'flex-start',
    // marginBottom: t.spacing(1),
    [t.breakpoints.up('sm')]: {
      // marginBottom: t.spacing(2),
    },
    [t.breakpoints.up('md')]: {
      ...t.typography.h5,
    },
  },
  headingText: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    flexGrow: 1,
  },
  actions: {
    marginLeft: t.spacing(2),
    flexShrink: 0,
    marginTop: '2px',
    display: 'flex',
  },
  menu: {
    display: 'flex',
    marginLeft: t.spacing(1),
  },
}))

interface HeaderProps {
  className?: string
  downloadable?: boolean
  expanded: boolean
  handle?: Model.S3.S3ObjectLocation
  heading: React.ReactNode
  onToggle?: () => void
}

export default function Header({
  downloadable = false,
  expanded,
  handle,
  heading,
  onToggle,
  className,
}: HeaderProps) {
  const classes = useStyles()
  return (
    <div className={cx(classes.heading, className)}>
      <div className={classes.headingText}>{heading}</div>
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
