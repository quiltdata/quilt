import * as React from 'react'
import * as M from '@material-ui/core'

import * as Buttons from 'components/Buttons'
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

interface PreviewButtonProps extends EditorState {
  className?: string
}

export function PreviewButton({ className, preview, onPreview }: PreviewButtonProps) {
  const handleClick = React.useCallback(
    (event) => {
      if (!onPreview) {
        // eslint-disable-next-line no-console
        console.error('Unsupported preview')
        return
      }
      event.stopPropagation()
      onPreview(!preview)
    },
    [onPreview, preview],
  )
  if (!onPreview) return null
  if (preview) {
    return (
      <M.Button
        className={className}
        color="primary"
        size="small"
        variant="contained"
        onClick={handleClick}
      >
        Continue writing
      </M.Button>
    )
  }
  return (
    <M.Button
      className={className}
      color="default"
      size="small"
      startIcon={<M.Icon fontSize="inherit">check_box_outline_blank</M.Icon>}
      variant="outlined"
      onClick={handleClick}
    >
      Preview
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
  const hasMultipleChoices = types.length > 1
  const handleEditClick = React.useCallback(
    (event) => {
      if (hasMultipleChoices) {
        setAnchorEl(event.currentTarget)
      } else {
        onEdit(types[0])
      }
    },
    [hasMultipleChoices, onEdit, types],
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
        <Buttons.Iconized
          className={className}
          disabled={disabled}
          icon="edit"
          label="Edit"
          onClick={handleEditClick}
        />
        {hasMultipleChoices && (
          <M.Menu open={!!anchorEl} anchorEl={anchorEl} onClose={() => setAnchorEl(null)}>
            {types.map((type) => (
              <M.MenuItem onClick={() => handleTypeClick(type)} key={type.brace}>
                {type.title || 'Edit file'}
              </M.MenuItem>
            ))}
          </M.Menu>
        )}
      </>
    )
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
