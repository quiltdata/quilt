import * as React from 'react'
import * as M from '@material-ui/core'

import { EditorState } from './State'

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
  onClick: (event: React.MouseEvent) => void
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

interface ControlsProps extends EditorState {
  className?: string
}

export function Controls({
  className,
  editing,
  onCancel,
  onEdit,
  saving,
  onSave,
  types,
}: ControlsProps) {
  const [anchorEl, setAnchorEl] = React.useState<HTMLElement | null>(null)
  const disabled = saving
  const handleEditClick = React.useCallback(
    (event) => setAnchorEl(event.currentTarget),
    [],
  )
  const handleTypeClick = React.useCallback(
    (type) => {
      onEdit(type)
      setAnchorEl(null)
    },
    [onEdit],
  )
  if (!editing)
    return (
      <>
        <ButtonControl
          className={className}
          disabled={disabled}
          icon="edit"
          label="Edit"
          onClick={handleEditClick}
        />
        <M.Menu open={!!anchorEl} anchorEl={anchorEl} onClose={() => setAnchorEl(null)}>
          {types.map((type) => (
            <M.MenuItem onClick={() => handleTypeClick(type)} key={type.brace}>
              Edit as {type.title || type.brace}
            </M.MenuItem>
          ))}
        </M.Menu>
      </>
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
