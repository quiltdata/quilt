import * as uuid from 'uuid'

import { PUSH, DISMISS } from './constants'

const DEFAULT_TTL = 4000

export const push = (message, { action, ttl = DEFAULT_TTL } = {}) => ({
  type: PUSH,
  notification: {
    id: uuid.v1(),
    message,
    action,
    ttl,
  },
})

export const dismiss = (id) => ({
  type: DISMISS,
  id,
})
