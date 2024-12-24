import memoize from 'lodash/memoize'
import * as R from 'ramda'
import * as React from 'react'
import * as redux from 'react-redux'
import { Redirect, useLocation } from 'react-router-dom'
import { createStructuredSelector } from 'reselect'
import * as M from '@material-ui/core'

import Error from 'components/Error'
import Layout from 'components/Layout'
import Working from 'components/Working'
import * as NamedRoutes from 'utils/NamedRoutes'

import { check } from './actions'
import { InvalidToken } from './errors'
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
        headline="Authentication error"
        detail={
          <span>
            Something went wrong. Try again.
            <M.Button
              variant="contained"
              color="primary"
              className={classes.button}
              onClick={retry}
            >
              Retry
            </M.Button>
          </span>
        }
      />
    </Layout>
  )
}

const useNotAuthorizedStyles = M.makeStyles((t) => ({
  heading: {
    marginTop: t.spacing(10),
  },
}))

function NotAuthorized() {
  const classes = useNotAuthorizedStyles()
  return (
    <Layout>
      <M.Typography variant="h3" align="center" className={classes.heading} gutterBottom>
        Not Authorized
      </M.Typography>
      <M.Typography variant="body1" align="center">
        Contact a Quilt admin to perform this task.
      </M.Typography>
    </Layout>
  )
}

export default function requireAuth<Props = {}>({ authorizedSelector = R.T } = {}) {
  const select = createStructuredSelector({
    authenticated: selectors.authenticated,
    authorized: authorizedSelector,
    error: selectors.error,
    waiting: selectors.waiting,
  })
  return memoize((Component) => (props: Props) => {
    const state = redux.useSelector(select)
    const location = useLocation()
    const { urls } = NamedRoutes.use()

    if (state.error && !(state.error instanceof InvalidToken)) {
      return <ErrorScreen />
    }

    // TODO: use suspense
    if (state.waiting) {
      return <Working>Authenticating…</Working>
    }

    if (!state.authenticated) {
      return <Redirect to={urls.signIn(location.pathname + location.search)} />
    }

    if (!state.authorized) {
      return <NotAuthorized />
    }

    return <Component {...props} />
  })
}
