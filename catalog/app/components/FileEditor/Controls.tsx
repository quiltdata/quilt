import * as React from 'react'
import * as M from '@material-ui/core'

import * as Buttons from 'components/Buttons'

import type { EditorState } from './State'

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

interface ControlsProps extends EditorState {
  className?: string
}

export function Controls({ className, onCancel, saving, onSave }: ControlsProps) {
  const disabled = saving
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
