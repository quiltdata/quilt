import uuid from 'uuid/v1';

import { PUSH, DISMISS } from './constants';

const DEFAULT_TTL = 4000;

export const push = (message, { action, ttl = DEFAULT_TTL } = {}) => ({
  type: PUSH,
  notification: {
    id: uuid(),
    message,
    action,
    ttl,
  },
});

export const dismiss = (id) => ({
  type: DISMISS,
  id,
})
