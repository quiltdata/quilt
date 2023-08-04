import * as React from 'react'
import * as M from '@material-ui/core'

import * as Dialog from 'components/Dialog'

function validateFileName(value: string) {
  if (!value) return new Error('File name is required')
}

interface EditFileNameProps {
  disabled?: boolean
  onChange: (e: React.FormEvent, value: string) => void
  value?: string
}

export default function EditFileName({ disabled, value, onChange }: EditFileNameProps) {
  const prompt = Dialog.usePrompt({
    initialValue: value,
    onSubmit: onChange,
    submitTitle: 'Rename',
    title: 'Enter file name',
    validate: validateFileName,
  })

  if (disabled) {
    return (
      <M.IconButton size="small" disabled>
        <M.Icon fontSize="inherit">edit_outlined</M.Icon>
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
        <M.Icon fontSize="inherit">edit_outlined</M.Icon>
      </M.IconButton>

      {prompt.render()}
    </>
  )
}
