import * as React from 'react'
import { FormattedMessage as FM } from 'react-intl'
import { Redirect } from 'react-router-dom'
import * as redux from 'react-redux'
import { createStructuredSelector } from 'reselect'
import * as M from '@material-ui/core'

import Layout from 'components/Layout'
import Working from 'components/Working'
import * as Sentry from 'utils/Sentry'
import defer from 'utils/defer'

import { signOut } from './actions'
import msg from './messages'
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
    result.promise.catch(sentry('captureException'))
    return result.promise
  }, [dispatch, sentry])
}

export default function SignOut() {
  const signOutRef = React.useRef()
  signOutRef.current = useSignOut()
  const { waiting, authenticated } = redux.useSelector(selector)
  React.useEffect(() => {
    if (!waiting && authenticated) signOutRef.current()
  }, [waiting, authenticated])
  return (
    <>
      {!authenticated && <Redirect to="/" />}
      <Layout>
        <M.Box mt={5} textAlign="center">
          <Working>
            <FM {...msg.signOutWaiting} />
          </Working>
        </M.Box>
      </Layout>
    </>
  )
}
