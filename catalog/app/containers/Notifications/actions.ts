import * as React from 'react'
import * as uuid from 'uuid'

import { PUSH, DISMISS } from './constants'

const DEFAULT_TTL = 4000

interface PushAction {
  onClick: () => void
  label: React.ReactNode
}

interface PushOptions {
  action?: PushAction
  ttl?: number
}

export const push = (
  message: React.ReactNode,
  { action, ttl = DEFAULT_TTL }: PushOptions = {},
) => ({
  type: PUSH,
  notification: {
    id: uuid.v1(),
    message,
    action,
    ttl,
  },
})

export const dismiss = (id: string) => ({
  type: DISMISS,
  id,
})
