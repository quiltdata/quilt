import * as React from 'react'
import * as M from '@material-ui/core'

import * as Dialog from 'components/Dialog'

interface IconProps {
  color: M.PropTypes.Color | 'disabled'
}

function Icon({ color }: IconProps) {
  return (
    <M.Icon fontSize="inherit" color={color}>
      edit_outlined
    </M.Icon>
  )
}

function validateFileName(value: string) {
  if (!value) return new Error('File name is required')
}

interface EditFileNameProps {
  disabled?: boolean
  onChange: (value: string) => void
  value?: string
  state?: string
}

export default function EditFileName({
  disabled,
  state,
  value,
  onChange,
}: EditFileNameProps) {
  const prompt = Dialog.usePrompt({
    onSubmit: onChange,
    initialValue: value,
    title: 'Enter file name',
    validate: validateFileName,
  })
  const color = React.useMemo(
    () => (state === 'invalid' || !value ? 'inherit' : 'primary'),
    [state, value],
  )

  if (disabled) {
    return (
      <M.IconButton size="small" disabled>
        <Icon color="disabled" />
      </M.IconButton>
    )
  }

  return (
    <>
      <M.IconButton
        color="inherit"
        onClick={prompt.open}
        title="Edit file name"
        size="small"
      >
        <Icon color={color} />
      </M.IconButton>

      {prompt.render()}
    </>
  )
}
