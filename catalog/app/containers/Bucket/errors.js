import * as R from 'ramda'
import * as React from 'react'
import { connect } from 'react-redux'
import { Route, Link } from 'react-router-dom'
import { createStructuredSelector } from 'reselect'
import Button from '@material-ui/core/Button'

import Message from 'components/Message'
import * as Auth from 'containers/Auth'
import { docs } from 'constants/urls'
import * as NamedRoutes from 'utils/NamedRoutes'
import StyledLink from 'utils/StyledLink'
import { BaseError } from 'utils/error'
import * as RT from 'utils/reactTools'

export class BucketError extends BaseError {}

export class AccessDenied extends BucketError {}

export class CORSError extends BucketError {}

export class NoSuchBucket extends BucketError {}

const WhenAuth = connect(
  createStructuredSelector({
    authenticated: Auth.selectors.authenticated,
  }),
)(({ authenticated, cases, args }) => cases[authenticated](...args))

const whenAuth = (cases) => (...args) => <WhenAuth {...{ cases, args }} />

const SignIn = RT.composeComponent('Bucket.errors.SignIn', () => (
  <NamedRoutes.Inject>
    {({ urls }) => (
      <Route>
        {({ location: l }) => (
          <Button
            component={Link}
            to={urls.signIn(l.pathname + l.search + l.hash)}
            variant="contained"
            color="primary"
          >
            Sign In
          </Button>
        )}
      </Route>
    )}
  </NamedRoutes.Inject>
))

const defaultHandlers = [
  [
    R.is(CORSError),
    () => (
      <Message headline="Error">
        Seems like this bucket is not configured for Quilt 3.
        <br />
        <StyledLink
          href={`${docs}/references/technical-reference#deploy-a-private-quilt-instance-on-aws`}
        >
          Learn how to configure the bucket for Quilt 3
        </StyledLink>
        .
      </Message>
    ),
  ],
  [
    R.is(NoSuchBucket),
    () => (
      <Message headline="No Such Bucket">The specified bucket does not exist.</Message>
    ),
  ],
  [
    R.is(AccessDenied),
    whenAuth({
      true: () => (
        <Message headline="Access Denied">
          Seems like you don&apos;t have access to this bucket.
          <br />
          <StyledLink
            href={`${docs}/walkthrough/working-with-the-catalog#access-control`}
          >
            Learn about access control in Quilt 3
          </StyledLink>
          .
        </Message>
      ),
      false: () => (
        <Message headline="Access Denied">
          Anonymous access not allowed. Please sign in.
          <br />
          <br />
          <SignIn />
        </Message>
      ),
    }),
  ],
]

export const displayError = (pairs = []) =>
  R.cond([
    ...defaultHandlers,
    ...pairs,
    [
      R.T,
      (e) => {
        throw e
      },
    ],
  ])
