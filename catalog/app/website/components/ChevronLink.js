import { Link } from 'react-router-dom'
import * as React from 'react'
import * as M from '@material-ui/core'

export default ({ children, ...props }) => (
  <M.Link
    color="textPrimary"
    underline="none"
    component={props.to ? Link : undefined}
    {...props}
  >
    {children}
    <M.Icon color="primary" style={{ verticalAlign: 'middle' }}>
      chevron_right
    </M.Icon>
  </M.Link>
)
