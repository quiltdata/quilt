import cx from 'classnames'
import * as React from 'react'
import { Link } from 'react-router-dom'
import * as M from '@material-ui/core'

export const linkStyle = {
  '&, &:visited': {
    color: M.colors.blue[900],
    cursor: 'pointer',
  },
  '&:hover, &:focus': {
    color: M.colors.blue[500],
  },
}

const useStyles = M.makeStyles(() => ({ root: linkStyle }))

export default React.forwardRef(function StyledLink(
  { component, className, ...props },
  ref,
) {
  const classes = useStyles()
  const Component = component || (props.to ? Link : 'a')
  return <Component className={cx(className, classes.root)} {...props} ref={ref} />
})
