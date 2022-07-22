import * as React from 'react'
import * as M from '@material-ui/core'

interface ButtonControlProps {
  className?: string
  color?: 'primary'
  icon: string
  label: string
  onClick: () => void
  variant?: 'outlined' | 'contained'
}

function ButtonControl({
  className,
  color,
  icon,
  label,
  onClick,
  variant = 'outlined',
}: ButtonControlProps) {
  const t = M.useTheme()
  const sm = M.useMediaQuery(t.breakpoints.down('sm'))
  return sm ? (
    <M.IconButton
      className={className}
      edge="end"
      size="small"
      onClick={onClick}
      title={label}
      color={color}
    >
      <M.Icon>{icon}</M.Icon>
    </M.IconButton>
  ) : (
    <M.Button
      className={className}
      color={color}
      onClick={onClick}
      size="small"
      startIcon={<M.Icon>{icon}</M.Icon>}
      variant={variant}
    >
      {label}
    </M.Button>
  )
}

interface ControlsProps {
  className?: string
  editing: boolean
  onEdit: () => void
  onSave: () => void
  onCancel: () => void
}

export default function Controls({
  className,
  editing,
  onEdit,
  onSave,
  onCancel,
}: ControlsProps) {
  if (!editing)
    return (
      <ButtonControl label="Edit" onClick={onEdit} icon="edit" className={className} />
    )
  return (
    <M.ButtonGroup className={className} size="small">
      <ButtonControl icon="undo" onClick={onCancel} label="Cancel" />
      <ButtonControl
        color="primary"
        icon="save"
        label="Save"
        onClick={onSave}
        variant="contained"
      />
    </M.ButtonGroup>
  )
}
