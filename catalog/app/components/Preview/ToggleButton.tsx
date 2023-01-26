import * as React from 'react'
import * as M from '@material-ui/core'

import ButtonIconShrinking from 'components/Buttons/ButtonIconShrinking'

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
  return (
    <M.Box className={className} {...props}>
      <ButtonIconShrinking
        label={expanded ? 'Collapse' : 'Expand'}
        icon={expanded ? 'unfold_less' : 'unfold_more'}
        rotate={expanded}
        onClick={onToggle}
      />
    </M.Box>
  )
}
