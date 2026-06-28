import { actionCreator } from 'utils/reduxTools'
import { Resolver } from 'utils/defer'

import { actions } from './constants'

// Some action creators carry a companion `.resolve` creator for their result
// action, attached immediately after definition.
type ActionCreator = ReturnType<typeof actionCreator>
type ResolvableAction = ActionCreator & { resolve: ActionCreator }

interface SignUpCredentials {
  username: string
  email: string
  password: string
}

export const signUp = actionCreator(
  actions.SIGN_UP,
  (credentials: SignUpCredentials, resolver: Resolver<any>) => ({
    payload: credentials,
    meta: { ...resolver },
  }),
)

export const resetPassword = actionCreator(
  actions.RESET_PASSWORD,
  (email: string, resolver: Resolver<any>) => ({
    payload: email,
    meta: { ...resolver },
  }),
)

export const changePassword = actionCreator(
  actions.CHANGE_PASSWORD,
  (link: string, password: string, resolver: Resolver<any>) => ({
    payload: { link, password },
    meta: { ...resolver },
  }),
)

export const getCode = actionCreator(actions.GET_CODE, (resolver: Resolver<any>) => ({
  meta: { ...resolver },
}))

interface SignInCredentials {
  username: string
  password: string
}

export const signIn = actionCreator(
  actions.SIGN_IN,
  (credentials: SignInCredentials, resolver: Resolver<any>) => ({
    payload: credentials,
    meta: { ...resolver },
  }),
) as ResolvableAction

// Either an error or an object containing tokens and user data.
// If error, action.error is true.
signIn.resolve = actionCreator(
  actions.SIGN_IN_RESULT,
  (payload: { tokens: object; user: object } | Error) => ({
    error: payload instanceof Error,
    payload,
  }),
)

export const signOut = actionCreator(actions.SIGN_OUT, (resolver: Resolver<any>) => ({
  meta: { ...resolver },
})) as ResolvableAction

signOut.resolve = actionCreator(actions.SIGN_OUT_RESULT, (result: Error | null) => ({
  error: result instanceof Error,
  payload: result,
}))

interface CheckOptions {
  // If true, user data will be refetched after token refresh.
  refetch?: boolean
}

export const check = actionCreator(
  actions.CHECK,
  // eslint-disable-next-line @typescript-eslint/default-param-last
  ({ refetch = true }: CheckOptions = {}, resolver: Resolver<any>) => ({
    payload: { refetch },
    meta: { ...resolver },
  }),
)

export const getTokens = actionCreator(actions.GET_TOKENS, (resolver: Resolver<any>) => ({
  meta: { ...resolver },
}))

export const refresh = actionCreator(actions.REFRESH) as ResolvableAction

refresh.resolve = actionCreator(
  actions.REFRESH_RESULT,
  (payload: { tokens: object; user: object } | Error) => ({
    error: payload instanceof Error,
    payload,
  }),
)

// Error that caused authentication loss.
export const authLost = actionCreator(actions.AUTH_LOST, (payload: Error) => ({
  payload,
}))
