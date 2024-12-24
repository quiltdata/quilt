import cx from 'classnames'
import { Link, LinkProps } from 'react-router-dom'
import * as React from 'react'
import * as M from '@material-ui/core'

const useStyles = M.makeStyles((t) => ({
  root: {
    color: t.palette.text.primary,
    '&:hover $icon': {
      left: '2px',
    },
  },
  icon: {
    color: t.palette.primary.main,
    left: 0,
    position: 'relative',
    transition: 'ease 0.1s left',
    verticalAlign: 'middle',
  },
}))

type ChevronLinkProps = M.LinkProps & Partial<LinkProps>

export default function ChevronLink({ children, className, ...props }: ChevronLinkProps) {
  const classes = useStyles()
  return (
    <M.Link
      className={cx(classes.root, className)}
      component={props.to ? Link : undefined}
      underline="none"
      {...props}
    >
      {children}
      <M.Icon className={classes.icon}>chevron_right</M.Icon>
    </M.Link>
  )
}
