/* Spinner */
import cx from 'classnames'
import PT from 'prop-types'
import * as React from 'react'
import * as RC from 'recompose'
import { withStyles } from '@material-ui/styles'

import * as RT from 'utils/reactTools'

export default RT.composeComponent(
  'Spinner',
  RC.setPropTypes({
    className: PT.string,
    drop: PT.any,
  }),
  withStyles(() => ({
    root: {
      display: 'inline-block',
      paddingTop: (props) => props.drop || 0,
    },
  })),
  ({ classes, className, drop, ...props }) => (
    <div className={cx(className, classes.root)} {...props}>
      <i className="fa fa-cog fa-fw fa-spin" />
    </div>
  ),
)
