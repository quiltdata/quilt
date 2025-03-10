import * as React from 'react'
import * as M from '@material-ui/core'

import * as Buttons from 'components/Buttons'
import StyledTooltip from 'utils/StyledTooltip'

const useStyles = M.makeStyles((t) => ({
  tooltip: {
    minWidth: t.spacing(60),
    padding: 0,
    [t.breakpoints.down('sm')]: {
      width: 'calc(100vw - 16px)',
    },
  },
}))

interface ButtonProps {
  label?: string
  className?: string
  children: NonNullable<React.ReactNode>
}

export default function Button({ className, children, label }: ButtonProps) {
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
          title={<div>{children}</div>}
          PopperProps={{
            anchorEl: anchorRef.current,
            disablePortal: true,
          }}
        >
          <div>
            <Buttons.Iconized
              className={className}
              endIcon={<M.Icon>arrow_drop_down</M.Icon>}
              onClick={handleButtonClick}
              size="small"
              icon="download"
              variant="outlined"
              label={label || 'Download'}
            />
          </div>
        </StyledTooltip>
      </div>
    </M.ClickAwayListener>
  )
}
