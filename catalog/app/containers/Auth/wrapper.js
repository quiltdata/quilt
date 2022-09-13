import memoize from 'lodash/memoize'
import * as R from 'ramda'
import * as React from 'react'
import * as redux from 'react-redux'
import { Redirect } from 'react-router-dom'
import { createStructuredSelector } from 'reselect'
import Button from '@material-ui/core/Button'
import Typography from '@material-ui/core/Typography'
import * as M from '@material-ui/core'

import Error from 'components/Error'
import Layout from 'components/Layout'
import Working from 'components/Working'
import * as NamedRoutes from 'utils/NamedRoutes'
import { selectLocation } from 'utils/router'

import { check } from './actions'
import { InvalidToken } from './errors'
import * as selectors from './selectors'

const ErrorScreen = () => {
  const dispatch = redux.useDispatch()
  const retry = React.useCallback(() => dispatch(check()), [dispatch])

  return (
    <Layout>
      <Error
        headline="Authentication error"
        detail={
          <span>
            Something went wrong. Try again.
            <Button
              variant="contained"
              color="primary"
              style={{ marginLeft: '1em' }}
              onClick={retry}
              label="Retry"
            />
          </span>
        }
      />
    </Layout>
  )
}

const useStyles = M.makeStyles((t) => ({
  heading: {
    marginTop: t.spacing(10),
  },
}))

function NotAuthorized() {
  const classes = useStyles()
  return (
    <Layout>
      <Typography variant="h3" align="center" className={classes.heading} gutterBottom>
        Not Authorized
      </Typography>
      <Typography variant="body1" align="center">
        Contact a Quilt admin to perform this task.
      </Typography>
    </Layout>
  )
}

export default ({ authorizedSelector = R.T } = {}) => {
  const select = createStructuredSelector({
    authenticated: selectors.authenticated,
    authorized: authorizedSelector,
    error: selectors.error,
    waiting: selectors.waiting,
    location: selectLocation,
  })
  return memoize((Component) => (props) => {
    const state = redux.useSelector(select)
    const { urls } = NamedRoutes.use()

    if (state.error && !(state.error instanceof InvalidToken)) {
      return <ErrorScreen />
    }

    // TODO: use suspense
    if (state.waiting) {
      return <Working>Authenticating…</Working>
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
