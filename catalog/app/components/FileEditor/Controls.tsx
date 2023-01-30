import * as React from 'react'
import * as M from '@material-ui/core'

import ButtonIconShrinking from 'components/Buttons/ButtonIconShrinking'

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
      <ButtonIconShrinking
        className={className}
        disabled={disabled}
        icon="edit"
        label="Edit"
        onClick={onEdit}
      />
    )
  return (
    <M.ButtonGroup disabled={disabled} className={className} size="small">
      <ButtonIconShrinking icon="undo" onClick={onCancel} label="Cancel" />
      <ButtonIconShrinking
        color="primary"
        icon="save"
        label="Save"
        onClick={onSave}
        variant="contained"
      />
    </M.ButtonGroup>
  )
}
