import React from 'react'
import * as M from '@material-ui/core'

import * as Assistant from 'components/Assistant'

export default function QuratorButton() {
  const assistant = Assistant.useAssistantCtx()
  if (!assistant) return null
  const msg = 'Summarize this document'
  return (
    <M.IconButton color="primary" onClick={() => assistant.open(msg)} edge="end">
      <M.Tooltip title="Summarize and chat with AI">
        <M.Icon>assistant</M.Icon>
      </M.Tooltip>
    </M.IconButton>
  )
}
