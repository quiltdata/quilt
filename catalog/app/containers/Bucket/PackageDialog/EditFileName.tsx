import * as React from 'react'
import * as M from '@material-ui/core'

import * as Dialog from 'components/Dialog'
import type * as Model from 'model'

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

interface EditNameProps {
  disabled?: boolean
  path: string
  onChange: (value: string) => void
  value?: Model.EntryMeta
  state?: string
}

export default function EditFileName({
  disabled,
  path,
  state,
  value,
  onChange,
}: EditNameProps) {
  const prompt = Dialog.usePrompt({
    onSubmit: onChange,
    initialValue: path,
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
      <M.IconButton color="inherit" onClick={prompt.open} title="Edit meta" size="small">
        <Icon color={color} />
      </M.IconButton>

      {prompt.render()}
    </>
  )
}
