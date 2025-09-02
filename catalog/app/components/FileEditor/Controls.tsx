import * as React from 'react'
import * as M from '@material-ui/core'

import * as Buttons from 'components/Buttons'
import type { EditorState } from './State'
import type { EditorInputType } from './types'

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

interface PreviewButtonProps extends EditorState {
  className?: string
  onPreview: NonNullable<EditorState['onPreview']>
}

export function PreviewButton({ className, preview, onPreview }: PreviewButtonProps) {
  const handleClick = React.useCallback(() => onPreview(!preview), [onPreview, preview])
  return (
    <M.FormControlLabel
      onClick={(event) => event.stopPropagation()}
      className={className}
      control={
        <M.Switch checked={preview} onChange={handleClick} size="small" color="primary" />
      }
      label="Preview"
      labelPlacement="end"
    />
  )
}

const LIST_ITEM_TYPOGRAPHY_PROPS = { noWrap: true }

interface ListItemProps {
  onEdit: (type: EditorInputType | null) => void
  type: EditorInputType
}
function ListItem({ onEdit, type }: ListItemProps) {
  const handleEdit = React.useCallback(() => onEdit(type), [onEdit, type])
  return (
    <M.ListItem onClick={handleEdit} button>
      <M.ListItemText
        primary={type.title || 'Edit file'}
        primaryTypographyProps={LIST_ITEM_TYPOGRAPHY_PROPS}
      />
    </M.ListItem>
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
  const disabled = saving
  const handleEditClick = React.useCallback(() => onEdit(types[0]), [onEdit, types])
  if (editing) {
    return (
      <M.ButtonGroup disabled={disabled} className={className} size="small">
        <Buttons.Iconized icon="undo" onClick={onCancel} label="Cancel" />
        <Buttons.Iconized
          color="primary"
          icon="save"
          label="Save"
          onClick={onSave}
          variant="contained"
        />
      </M.ButtonGroup>
    )
  }

  if (types.length > 1) {
    return (
      <Buttons.WithPopover
        className={className}
        disabled={disabled}
        icon="edit"
        label="Edit"
      >
        <M.List dense>
          {types.map((type) => (
            <ListItem key={type.brace} onEdit={onEdit} type={type} />
          ))}
        </M.List>
      </Buttons.WithPopover>
    )
  }

  return (
    <M.ButtonGroup disabled={disabled} className={className} size="small">
      <Buttons.Iconized
        disabled={disabled}
        icon="edit"
        label="Edit"
        onClick={handleEditClick}
      />
      <Buttons.Iconized
        className={className}
        disabled={disabled}
        icon="delete"
        label="Delete"
        onClick={() => alert('not implemented!')}
      />
    </M.ButtonGroup>
  )
}
