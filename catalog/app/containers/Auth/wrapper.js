import memoize from 'lodash/memoize'
import * as R from 'ramda'
import * as React from 'react'
import { FormattedMessage as FM } from 'react-intl'
import { Redirect } from 'react-router-dom'
import * as reduxHook from 'redux-react-hook'
import { createStructuredSelector } from 'reselect'
import Button from '@material-ui/core/Button'
import Typography from '@material-ui/core/Typography'
import { withStyles } from '@material-ui/core/styles'

import Error from 'components/Error'
import Layout from 'components/Layout'
import Working from 'components/Working'
import * as NamedRoutes from 'utils/NamedRoutes'
import * as RT from 'utils/reactTools'
import { selectLocation } from 'utils/router'

import { check } from './actions'
import { InvalidToken } from './errors'
import msg from './messages'
import * as selectors from './selectors'

const ErrorScreen = () => {
  const dispatch = reduxHook.useDispatch()
  const retry = React.useCallback(() => dispatch(check()), [dispatch])

  return (
    <Layout>
      <Error
        headline={<FM {...msg.wrapperFailureHeading} />}
        detail={
          <span>
            <FM {...msg.wrapperFailureDescription} />
            <Button
              variant="contained"
              color="primary"
              style={{ marginLeft: '1em' }}
              onClick={retry}
              label={<FM {...msg.wrapperFailureRetry} />}
            />
          </span>
        }
      />
    </Layout>
  )
}

const NotAuthorized = RT.composeComponent(
  'Auth.Wrapper.NotAuthorized',
  withStyles((t) => ({
    heading: {
      marginTop: t.spacing.unit * 10,
    },
  })),
  ({ classes }) => (
    <Layout>
      <Typography variant="h3" align="center" className={classes.heading} gutterBottom>
        Not Authorized
      </Typography>
      <Typography variant="body1" align="center">
        You are not authorized to visit this page.
      </Typography>
    </Layout>
  ),
)

export default ({ authorizedSelector = R.T } = {}) =>
  memoize(
    RT.composeHOC('Auth.Wrapper', (Component) => (props) => {
      const select = React.useMemo(
        () =>
          createStructuredSelector({
            authenticated: selectors.authenticated,
            authorized: authorizedSelector,
            error: selectors.error,
            waiting: selectors.waiting,
            location: selectLocation,
          }),
        [authorizedSelector],
      )
      const state = reduxHook.useMappedState(select)
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
    }),
  )
