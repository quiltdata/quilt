import * as M from '@material-ui/core'
import memoize from 'lodash/memoize'
import * as R from 'ramda'
import * as React from 'react'
import { FormattedMessage as FM } from 'react-intl'
import * as redux from 'react-redux'
import { Redirect } from 'react-router-dom'
import { createStructuredSelector } from 'reselect'

import Error from 'components/Error'
import Layout from 'components/Layout'
import Working from 'components/Working'
import * as NamedRoutes from 'utils/NamedRoutes'
import { selectLocation } from 'utils/router'

import { check } from './actions'
import { InvalidToken } from './errors'
import msg from './messages'
import * as selectors from './selectors'

const useErrorScreenStyles = M.makeStyles({
  button: {
    marginLeft: '1em',
  },
})
const ErrorScreen = () => {
  const dispatch = redux.useDispatch()
  const retry = React.useCallback(() => dispatch(check()), [dispatch])
  const classes = useErrorScreenStyles()

  return (
    <Layout>
      <Error
        headline={<FM {...msg.wrapperFailureHeading} />}
        detail={
          <span>
            <FM {...msg.wrapperFailureDescription} />
            <M.Button
              variant="contained"
              color="primary"
              className={classes.button}
              onClick={retry}
              title="Retry"
            />
          </span>
        }
      />
    </Layout>
  )
}

const useNotAuthorizeStyles = M.makeStyles((t) => ({
  heading: {
    marginTop: t.spacing(10),
  },
}))

function NotAuthorized() {
  const classes = useNotAuthorizeStyles()
  return (
    <Layout>
      <M.Typography variant="h3" align="center" className={classes.heading} gutterBottom>
        Not Authorized
      </M.Typography>
      <M.Typography variant="body1" align="center">
        You are not authorized to visit this page.
      </M.Typography>
    </Layout>
  )
}

export default function requireAuth<T>({ authorizedSelector = R.T } = {}) {
  const select = createStructuredSelector({
    authenticated: selectors.authenticated,
    authorized: authorizedSelector,
    error: selectors.error,
    waiting: selectors.waiting,
    location: selectLocation,
  })
  return memoize((Component: React.ComponentType<T>) => (props: T) => {
    const state = redux.useSelector(select)
    const { urls } = NamedRoutes.use()

    if (state.error && !(state.error instanceof InvalidToken)) {
      return <ErrorScreen />
    }

    // TODO: use suspense
    if (state.waiting) {
      return (
        <Working>
          <FM {...msg.wrapperWorking} />
        </Working>
      )
    }

    if (!state.authenticated) {
      const l = state.location
      return <Redirect to={urls.signIn(l.pathname + l.search)} />
    }

    if (!state.authorized) {
      return <NotAuthorized />
    }

    return <Component {...props} />
  })
}
