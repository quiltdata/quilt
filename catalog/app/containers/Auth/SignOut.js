import * as React from 'react'
import { FormattedMessage as FM } from 'react-intl'
import { Redirect } from 'react-router-dom'
import * as redux from 'react-redux'
import { createStructuredSelector } from 'reselect'

import Working from 'components/Working'
import * as Config from 'utils/Config'
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
  }, [dispatch])
}

export default function SignOut() {
  const cfg = Config.useConfig()
  const doSignOut = useSignOut()
  const { waiting, authenticated } = redux.useSelector(selector)
  React.useEffect(() => {
    if (!waiting && authenticated) doSignOut()
  }, [waiting, authenticated])
  return (
    <>
      {!authenticated && <Redirect to={cfg.signOutRedirect} />}
      <Working>
        <FM {...msg.signOutWaiting} />
      </Working>
    </>
  )
}
