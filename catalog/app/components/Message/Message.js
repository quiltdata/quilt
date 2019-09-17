import * as React from 'react'
import * as M from '@material-ui/core'

export default function Message({ headline, children, ...props }) {
  return (
    <M.Box pt={5} textAlign="center" {...props}>
      {!!headline && <M.Typography variant="h4">{headline}</M.Typography>}
      {!!headline && !!children && <M.Box pt={2} />}
      {!!children && <M.Typography variant="body1">{children}</M.Typography>}
    </M.Box>
  )
}
