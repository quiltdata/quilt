import cx from 'classnames'
import * as React from 'react'
import { Link } from 'react-router-dom'
import * as colors from '@material-ui/core/colors'
import { withStyles } from '@material-ui/styles'

import * as RT from 'utils/reactTools'

export const linkStyle = {
  '&, &:visited': {
    color: colors.blue[900],
    cursor: 'pointer',
  },
  '&:hover, &:focus': {
    color: colors.blue[500],
  },
}

export default RT.composeComponent(
  'StyledLink',
  withStyles(() => ({ root: linkStyle })),
  ({ component, className, classes, ...props }) => {
    const Component = component || props.to ? Link : 'a'
    return <Component className={cx(className, classes.root)} {...props} />
  },
)
