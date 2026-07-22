import * as R from 'ramda'
import * as redux from 'react-redux'
import { createStructuredSelector } from 'reselect'

import * as authSelectors from 'containers/Auth/selectors'
import * as GQL from 'utils/GraphQL'
import * as tagged from 'utils/taggedV2'

import ME_QUERY from './gql/Me.generated'

type MaybeMe = GQL.DataForDoc<typeof ME_QUERY>['me']

export const AuthState = tagged.create(
  'app/containers/Sidebar/AuthState:AuthState' as const,
  {
    Loading: () => {},
    Error: (error: Error) => ({ error }),
    Ready: (user: MaybeMe) => ({ user }),
  },
)

// eslint-disable-next-line @typescript-eslint/no-redeclare
type AuthState = tagged.InstanceOf<typeof AuthState>

const authSelector = createStructuredSelector(
  R.pick(['error', 'waiting', 'authenticated'], authSelectors),
)

export function useAuthState(): AuthState {
  const { error, waiting, authenticated } = redux.useSelector(authSelector)
  const meQuery = GQL.useQuery(ME_QUERY, {}, { pause: waiting || !authenticated })
  if (error) return AuthState.Error(error)
  if (waiting) return AuthState.Loading()
  if (!authenticated) return AuthState.Ready(null)
  return GQL.fold(meQuery, {
    data: (d) =>
      d.me
        ? AuthState.Ready(d.me)
        : AuthState.Error(new Error("Couldn't load user data")),
    fetching: () => AuthState.Loading(),
    error: (err) => AuthState.Error(err),
  })
}
