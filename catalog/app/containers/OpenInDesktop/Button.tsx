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
  dropdownButton: {
    minWidth: 'auto',
    paddingLeft: t.spacing(0.5),
    paddingRight: t.spacing(0.5),
  },
  mainButton: {
    display: 'flex',
    alignItems: 'center',
  },
}))

interface ButtonProps {
  className?: string
  uri: PackageUri.PackageUri
  children: NonNullable<React.ReactNode>
}

export default function Button({ className, children, uri }: ButtonProps) {
  const classes = useStyles()
  const [tooltipOpen, setTooltipOpen] = React.useState(false)
  const anchorRef = React.useRef<HTMLDivElement>(null)

  const handleButtonClick = () => {
    setTooltipOpen((prevOpen) => !prevOpen)
  }

  const handleClose = () => {
    setTooltipOpen(false)
  }

  return (
    <M.ClickAwayListener onClickAway={handleClose}>
      <div ref={anchorRef}>
        <StyledTooltip
          classes={classes}
          interactive
          maxWidth="xl"
          open={tooltipOpen}
          placement="bottom-end"
          title={children}
          PopperProps={{
            anchorEl: anchorRef.current,
            disablePortal: true,
          }}
        >
          <M.ButtonGroup className={className} variant="contained" color="primary">
            <M.Button 
              className={classes.mainButton}
              onClick={handleButtonClick}
              startIcon={<M.Icon>download</M.Icon>}
            >
              Open in Desktop
            </M.Button>
            <M.Button 
              className={classes.dropdownButton}
              onClick={handleButtonClick}
            >
              <M.Icon>arrow_drop_down</M.Icon>
            </M.Button>
          </M.ButtonGroup>
        </StyledTooltip>
      </div>
    </M.ClickAwayListener>
  )
}
