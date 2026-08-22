// Shared auth-loss policy for both control-plane interceptors — the urql
// GraphQL exchange and the REST APIConnector middleware. Kept dependency-free
// so either transport can apply the identical decision.

export type AuthLossAction = 'redirect' | 'hold'

// Given a request that lost auth (a registry 401 with interception enabled),
// decide between:
// - 'redirect' — a credential WAS sent and still 401'd, so the session is
//   dead; or there is no session and none is being established (logged out).
// - 'hold' — no credential was sent AND a session already exists or is being
//   established. The request is a stale straggler issued before the session,
//   or a query racing the post-OAuth handshake; bouncing it would log out a
//   live/arriving session.
export function decideAuthLoss(p: {
  authAttached: boolean
  authenticated: boolean
  waiting: boolean
}): AuthLossAction {
  if (p.authAttached) return 'redirect'
  if (p.authenticated || p.waiting) return 'hold'
  return 'redirect'
}
