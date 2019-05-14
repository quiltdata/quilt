import cx from 'classnames'
import PT from 'prop-types'
import * as React from 'react'
import * as RC from 'recompose'
import Typography from '@material-ui/core/Typography'
import { withStyles } from '@material-ui/styles'

import Link from 'utils/StyledLink'
import * as RT from 'utils/reactTools'
import tagged from 'utils/tagged'

export const Crumb = tagged([
  'Segment', // { label, to }
  'Sep', // value
])

export const Segment = RT.composeComponent(
  'Bucket.BreadCrumbs.Segment',
  RC.setPropTypes({
    label: PT.string.isRequired,
    to: PT.string,
  }),
  withStyles(() => ({
    root: {
      whiteSpace: 'nowrap',
    },
  })),
  ({ classes, label, to }) => {
    const Component = to ? Link : 'span'
    return (
      <Component to={to} className={classes.root}>
        {label}
      </Component>
    )
  },
)

export default RT.composeComponent(
  'Bucket.BreadCrumbs',
  RC.setPropTypes({
    items: PT.array.isRequired,
  }),
  withStyles(({ typography }) => ({
    root: {
      fontWeight: typography.fontWeightRegular,
    },
  })),
  ({ className, variant = 'h6', classes, items }) => (
    <Typography variant={variant} className={cx(className, classes.root)}>
      {items.map(
        Crumb.case({
          Segment: (s, i) => <Segment key={`${i}:${s.label}`} {...s} />,
          Sep: (s, i) => <span key={`__sep${i}`}>{s}</span>,
        }),
      )}
    </Typography>
  ),
)
