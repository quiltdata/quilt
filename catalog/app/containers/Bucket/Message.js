import PT from 'prop-types'
import * as React from 'react'
import * as RC from 'recompose'
import Typography from '@material-ui/core/Typography'
import { withStyles } from '@material-ui/styles'

import * as RT from 'utils/reactTools'

export default RT.composeComponent(
  'Bucket.Message',
  RC.setPropTypes({
    headline: PT.node,
    children: PT.node,
  }),
  withStyles(({ spacing: { unit } }) => ({
    root: {
      marginTop: 5 * unit,
      textAlign: 'center',
    },
    headline: {},
    body: {
      marginTop: 2 * unit,
    },
  })),
  ({ classes, headline, children }) => (
    <div className={classes.root}>
      {!!headline && (
        <Typography variant="h4" className={classes.headline}>
          {headline}
        </Typography>
      )}
      {!!children && (
        <Typography variant="body1" className={classes.body}>
          {children}
        </Typography>
      )}
    </div>
  ),
)
