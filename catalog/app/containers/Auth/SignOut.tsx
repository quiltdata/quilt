import * as React from 'react'
import { Redirect } from 'react-router-dom'
import * as redux from 'react-redux'
import { createStructuredSelector } from 'reselect'
import * as M from '@material-ui/core'

import Layout from 'components/Layout'
import Working from 'components/Working'
import * as Sentry from 'utils/Sentry'
import defer from 'utils/defer'

import { signOut } from './actions'
import * as selectors from './selectors'

const selector = createStructuredSelector({
  authenticated: selectors.authenticated,
  waiting: selectors.waiting,
})

export function useSignOut() {
  const sentry = Sentry.use()
  const dispatch = redux.useDispatch()
  return React.useCallback(() => {
    const result = defer()
    dispatch(signOut(result.resolver))
    // NB: preserves the legacy behavior exactly — Sentry.use() returns the async
    // callSentry, so this eagerly invokes it and passes the resulting promise to
    // .catch (effectively no rejection handler). Cast to keep types happy.
    result.promise.catch(sentry('captureException') as any)
    return result.promise
  }, [dispatch, sentry])
}

export default function SignOut() {
  const signOutRef = React.useRef<ReturnType<typeof useSignOut>>()
  signOutRef.current = useSignOut()
  const { waiting, authenticated } = redux.useSelector(selector)
  React.useEffect(() => {
    if (!waiting && authenticated) signOutRef.current!()
  }, [waiting, authenticated])
  return (
    <>
      {!authenticated && <Redirect to="/" />}
      <Layout>
        <M.Box mt={5} textAlign="center">
          <Working>Signing out</Working>
        </M.Box>
      </Layout>
    </>
  )
}
