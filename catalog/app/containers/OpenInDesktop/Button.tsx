import * as React from 'react'
import * as M from '@material-ui/core'

import StyledTooltip from 'utils/StyledTooltip'

const useStyles = M.makeStyles((t) => ({
  tooltip: {
    width: t.spacing(60),
    padding: 0,
  },
}))

interface ButtonProps {
  className?: string
  children: NonNullable<React.ReactNode>
}

export default function Button({ className, children }: ButtonProps) {
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
          <M.ButtonGroup className={className} variant="outlined" size="small">
            <M.Button
              onClick={handleButtonClick}
              startIcon={<M.Icon>download</M.Icon>}
              endIcon={<M.Icon>arrow_drop_down</M.Icon>}
            >
              Open in Desktop
            </M.Button>
          </M.ButtonGroup>
        </StyledTooltip>
      </div>
    </M.ClickAwayListener>
  )
}
