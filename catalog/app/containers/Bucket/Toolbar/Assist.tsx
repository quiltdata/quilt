import * as React from 'react'
import * as M from '@material-ui/core'

import * as Assistant from 'components/Assistant'

interface AssistButtonProps extends M.IconButtonProps {
  title?: string
  message?: string
}

export default function AssistButton({ message, title, ...props }: AssistButtonProps) {
  const assist = Assistant.use()
  if (!assist) return null
  return (
    <M.IconButton
      color="primary"
      onClick={() => assist(message || 'Summarize this document')}
      style={{ marginTop: '-12px', marginBottom: '-12px' }}
      edge="end"
      {...props}
    >
      <M.Tooltip title={title || 'Summarize and chat with AI'}>
        <M.Icon>assistant</M.Icon>
      </M.Tooltip>
    </M.IconButton>
  )
}
