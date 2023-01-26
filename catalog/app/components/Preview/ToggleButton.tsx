import cx from 'classnames'
import * as React from 'react'
import * as M from '@material-ui/core'

import ShrinkingIconButton from 'components/Buttons/ShrinkingIconButton'

const useStyles = M.makeStyles((t) => ({
  root: {
    alignItems: 'center',
    display: 'flex',
    height: t.spacing(4),
    justifyContent: 'center',
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
      <ShrinkingIconButton
        label={expanded ? 'Collapse' : 'Expand'}
        icon={expanded ? 'unfold_less' : 'unfold_more'}
        rotate={expanded}
        onClick={onToggle}
      />
    </M.Box>
  )
}
