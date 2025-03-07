import * as React from 'react'
import * as M from '@material-ui/core'

import * as Buttons from 'components/Buttons'
import * as PackageUri from 'utils/PackageUri'
import StyledTooltip from 'utils/StyledTooltip'

const useStyles = M.makeStyles((t) => ({
  tooltip: {
    width: t.spacing(60),
    padding: 0,
  },
}))

interface ButtonProps {
  className?: string
  uri: PackageUri.PackageUri
  children: NonNullable<React.ReactNode>
}

export default function Button({ className, children, uri }: ButtonProps) {
  // TODO: wrap children and don't mount it until `open`
  const classes = useStyles()
  return (
    <StyledTooltip
      classes={classes}
      interactive
      maxWidth="xl"
      open
      placement="bottom-end"
      title={children}
    >
      <a href={PackageUri.stringify(uri)}>
        <Buttons.Iconized className={className} icon="download" label="Open in Desktop" />
      </a>
    </StyledTooltip>
  )
}
