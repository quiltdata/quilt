import * as Eff from 'effect'
import * as React from 'react'
import * as redux from 'react-redux'

import * as authActions from 'containers/Auth/actions'
import defer from 'utils/defer'

/**
 * The catalog session token, resolved through the auth saga so an expired
 * session is refreshed rather than handed over stale. Reading the store
 * directly would 401 forever after an idle tab, where the Bedrock path used to
 * self-heal through the credential refresh. `null` when there is no session.
 */
export default function useSessionToken(): () => Eff.Effect.Effect<string | null> {
  const dispatch = redux.useDispatch()
  return React.useCallback(
    () =>
      Eff.Effect.tryPromise({
        try: () => {
          const { resolver, promise } = defer<{ token?: string } | undefined>()
          dispatch(authActions.getTokens(resolver))
          return promise
        },
        catch: () => null,
      }).pipe(
        Eff.Effect.map((tokens) => tokens?.token ?? null),
        Eff.Effect.catchAll(() => Eff.Effect.succeed(null)),
      ),
    [dispatch],
  )
}
