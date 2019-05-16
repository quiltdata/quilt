import * as React from 'react'
import { FormattedMessage as FM } from 'react-intl'
import { Redirect } from 'react-router-dom'
import * as reduxHook from 'redux-react-hook'
import { createStructuredSelector } from 'reselect'

import Lifecycle from 'components/Lifecycle'
import Working from 'components/Working'
import * as Config from 'utils/Config'
import * as Sentry from 'utils/Sentry'
import defer from 'utils/defer'
import { composeComponent } from 'utils/reactTools'

import { signOut } from './actions'
import msg from './messages'
import * as selectors from './selectors'

const selector = createStructuredSelector({
  authenticated: selectors.authenticated,
  waiting: selectors.waiting,
})

export const useSignOut = () => {
  const sentry = Sentry.use()
  const dispatch = reduxHook.useDispatch()
  return React.useCallback(() => {
    const result = defer()
    dispatch(signOut(result.resolver))
    result.promise.catch(sentry('captureException'))
    return result.promise
  }, [dispatch])
}

export default composeComponent('Auth.SignOut', () => {
  const cfg = Config.useConfig()
  const doSignOut = useSignOut()
  const { waiting, authenticated } = reduxHook.useMappedState(selector)
  return (
    <React.Fragment>
      {!waiting && authenticated && <Lifecycle willMount={doSignOut} />}
      {!authenticated && <Redirect to={cfg.signOutRedirect} />}
      <Working>
        <FM {...msg.signOutWaiting} />
      </Working>
    </React.Fragment>
  )
})
