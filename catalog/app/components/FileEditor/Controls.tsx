import * as React from 'react'
import * as M from '@material-ui/core'

interface AddFileButtonProps {
  onClick: () => void
}

export function AddFileButton({ onClick }: AddFileButtonProps) {
  return (
    <M.Button variant="contained" color="primary" size="large" onClick={onClick}>
      Create file
    </M.Button>
  )
}

interface ButtonControlProps {
  disabled?: boolean
  className?: string
  color?: 'primary'
  icon: string
  label: string
  onClick: () => void
  variant?: 'outlined' | 'contained'
}

function ButtonControl({
  disabled,
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
      disabled={disabled}
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
      disabled={disabled}
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
  disabled?: boolean
  className?: string
  editing: boolean
  onEdit: () => void
  onSave: () => void
  onCancel: () => void
}

export function Controls({
  disabled,
  className,
  editing,
  onEdit,
  onSave,
  onCancel,
}: ControlsProps) {
  if (!editing)
    return (
      <ButtonControl
        className={className}
        disabled={disabled}
        icon="edit"
        label="Edit"
        onClick={onEdit}
      />
    )
  return (
    <M.ButtonGroup disabled={disabled} className={className} size="small">
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
