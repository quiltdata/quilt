import cx from 'classnames'
import * as React from 'react'
import * as M from '@material-ui/core'

import Link from 'utils/StyledLink'
import tagged from 'utils/tagged'

export const Crumb = tagged([
  'Segment', // { label, to }
  'Sep', // value
])

const useSegmentStyles = M.makeStyles({
  root: {
    whiteSpace: 'nowrap',
  },
})

export function Segment({ label, to }) {
  const classes = useSegmentStyles()
  const Component = to ? Link : 'span'
  return (
    <Component to={to} className={classes.root}>
      {label}
    </Component>
  )
}

const useBreadCrumbsStyles = M.makeStyles((t) => ({
  root: {
    fontWeight: t.typography.fontWeightRegular,
  },
}))

export const render = (items) =>
  items.map(
    Crumb.case({
      Segment: (s, i) => <Segment key={`${i}:${s.label}`} {...s} />,
      Sep: (s, i) => <span key={`__sep${i}`}>{s}</span>,
    }),
  )

export default function BreadCrumbs({ className, variant = 'h6', items }) {
  const classes = useBreadCrumbsStyles()
  return (
    <M.Typography variant={variant} className={cx(className, classes.root)}>
      {render(items)}
    </M.Typography>
  )
}

export function copyWithoutSpaces(e) {
  if (typeof document === 'undefined') return
  e.clipboardData.setData(
    'text/plain',
    document
      .getSelection()
      .toString()
      .replace(/\s*\/\s*/g, '/'),
  )
  e.preventDefault()
}
