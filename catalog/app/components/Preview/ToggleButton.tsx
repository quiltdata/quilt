import cx from 'classnames'
import * as React from 'react'
import * as M from '@material-ui/core'

const useStyles = M.makeStyles((t) => ({
  root: {
    alignItems: 'center',
    display: 'flex',
    height: t.spacing(4),
    justifyContent: 'center',
  },
  icon: {
    transition: 'ease transform .15s',
  },
  iconExpanded: {
    transform: `rotate(180deg)`,
  },
}))

interface ToggleButtonProps extends M.BoxProps {
  className?: string
  expanded?: boolean
  onToggle?: () => void
}

export default function ToggleButton({
  className,
  expanded,
  onToggle,
  ...props
}: ToggleButtonProps) {
  const classes = useStyles()
  return (
    <M.Box className={cx(classes.root, className)} {...props}>
      <M.Button
        onClick={onToggle}
        startIcon={
          <M.Icon className={cx(classes.icon, { [classes.iconExpanded]: expanded })}>
            {expanded ? 'unfold_less' : 'unfold_more'}
          </M.Icon>
        }
        variant="outlined"
        size="small"
      >
        {expanded ? 'Collapse' : 'Expand'}
      </M.Button>
    </M.Box>
  )
}
