import * as R from 'ramda'
import * as React from 'react'
import * as redux from 'react-redux'
import { Route, Link } from 'react-router-dom'
import * as M from '@material-ui/core'

import Message from 'components/Message'
import * as Auth from 'containers/Auth'
import { docs } from 'constants/urls'
import * as NamedRoutes from 'utils/NamedRoutes'
import StyledLink from 'utils/StyledLink'
import { BaseError } from 'utils/error'

export class BucketError extends BaseError {}

export class AccessDenied extends BucketError {}

export class CORSError extends BucketError {}

export class NoSuchBucket extends BucketError {}

interface NoSuchPackageProps {
  bucket: string
  handle: string
}

export class NoSuchPackage extends BucketError {
  static displayName = 'NoSuchPackage'

  constructor(props: NoSuchPackageProps) {
    super(`no package named '${props.handle}' in bucket '${props.bucket}'`, props)
  }
}

export class ESNoIndex extends BucketError {}

export class ESTimeout extends BucketError {}

export class ESThrottle extends BucketError {}

export class FileNotFound extends BucketError {}

export class VersionNotFound extends BucketError {}

export interface BucketPreferencesInvalidProps {
  errors: { instancePath?: string; message?: string }[]
}

export class BucketPreferencesInvalid extends BucketError {
  static displayName = 'BucketPreferencesInvalid'

  constructor(props: BucketPreferencesInvalidProps) {
    super(
      props.errors
        .map(({ instancePath, message }) => `${instancePath} ${message}`)
        .join(', '),
      props,
    )
  }
}

export interface WorkflowsConfigInvalidProps {
  errors: { instancePath?: string; message?: string }[]
}

export class WorkflowsConfigInvalid extends BucketError {
  static displayName = 'WorkflowsConfigInvalid'

  constructor(props: WorkflowsConfigInvalidProps) {
    super(
      props.errors
        .map(({ instancePath, message }) =>
          instancePath ? `${instancePath} ${message}` : message,
        )
        .join(', '),
      props,
    )
  }
}

export interface ManifestTooLargeProps {
  bucket: string
  key: string
  actualSize: number
  maxSize: number
}

export class ManifestTooLarge extends BucketError {
  static displayName = 'ManifestTooLarge'

  constructor(props: ManifestTooLargeProps) {
    super(
      `Package manifest at s3://${props.bucket}/${props.key} is too large: ${props.actualSize} (max size: ${props.maxSize})`,
      props,
    )
  }
}

export interface BadRevisionProps {
  bucket: string
  handle: string
  revision: string
}

export class BadRevision extends BucketError {
  static displayName = 'BadRevision'

  constructor(props: BadRevisionProps) {
    super(
      `Could not resolve revision "${props.revision}" for package "${props.handle}" in s3://${props.bucket}`,
      props,
    )
  }
}

interface WhenAuthCases {
  true: () => React.ReactElement
  false: () => React.ReactElement
}

interface WhenAuthProps {
  cases: WhenAuthCases
}

function WhenAuth({ cases }: WhenAuthProps) {
  const authenticated = redux.useSelector(Auth.selectors.authenticated)
  return cases[`${authenticated}` as 'true' | 'false']()
}

const whenAuth = (cases: WhenAuthCases) => () => <WhenAuth cases={cases} />

function SignIn() {
  const { urls } = NamedRoutes.use()
  return (
    <Route>
      {({ location: l }) => (
        <M.Button
          component={Link}
          to={urls.signIn(l.pathname + l.search + l.hash)}
          variant="contained"
          color="primary"
        >
          Sign In
        </M.Button>
      )}
    </Route>
  )
}

const defaultHandlers: ErrorHandler[] = [
  [
    R.is(CORSError),
    () => (
      <Message headline="Error">
        Seems like this bucket is not configured for Quilt.
        <br />
        <StyledLink
          target="_blank"
          href={`${docs}/references/technical-reference#deploy-a-private-quilt-instance-on-aws`}
        >
          Learn how to configure the bucket for Quilt
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
    R.is(NoSuchPackage),
    (e: NoSuchPackage) => (
      <Message headline="No Such Package">
        Package named{' '}
        <M.Box component="span" fontWeight="fontWeightMedium">{`"${e.handle}"`}</M.Box>{' '}
        could not be found in this bucket.
      </Message>
    ),
  ],
  [
    R.is(ESNoIndex),
    () => (
      <Message headline="Oops, no search cluster">
        The bucket owner needs to{' '}
        <StyledLink target="_blank" href={docs}>
          tie this bucket to Quilt
        </StyledLink>{' '}
        to enable Packages, Search, and detailed Overviews.
      </Message>
    ),
  ],
  [
    R.either(R.is(ESTimeout), R.is(ESThrottle)),
    () => (
      <Message headline="Whoa, search cluster is stressed out">
        ElasticSearch is stressed out. Please try again in a few minutes.
      </Message>
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
            target="_blank"
            href={`${docs}/walkthrough/working-with-the-catalog#access-control`}
          >
            Learn about access control in Quilt
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

type ErrorHandler = [(error: unknown) => boolean, (error: any) => React.ReactElement]

export const displayError = (pairs: ErrorHandler[] = []) =>
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

const startsWithSafe = (prefix: string) => (str: unknown) =>
  typeof str === 'string' ? str.startsWith(prefix) : false

type ErrorCatcher = [(error: unknown) => boolean, (error: unknown) => never]

export const catchErrors = (pairs: ErrorCatcher[] = []) =>
  R.cond([
    [
      R.propEq('message', 'Network Failure'),
      () => {
        throw new CORSError()
      },
    ],
    [
      R.propEq('message', 'Access Denied'),
      () => {
        throw new AccessDenied()
      },
    ],
    [
      R.propEq('code', 'Forbidden'),
      () => {
        throw new AccessDenied()
      },
    ],
    [
      R.propEq('code', 'NoSuchBucket'),
      () => {
        throw new NoSuchBucket()
      },
    ],
    [
      R.propEq(
        'message',
        "API Gateway error (500): NotFoundError(404, 'index_not_found_exception', 'no such index')",
      ),
      () => {
        throw new ESNoIndex()
      },
    ],
    [
      R.propSatisfies(
        startsWithSafe(
          'API Gateway error (500): ConnectionTimeout caused by - ReadTimeout',
        ),
        'message',
      ),
      () => {
        throw new ESTimeout()
      },
    ],
    [
      R.propSatisfies(
        startsWithSafe(
          "API Gateway error (500): AuthorizationException(403, '403 Request throttled due to too many requests",
        ),
        'message',
      ),
      () => {
        throw new ESThrottle()
      },
    ],
    ...pairs,
    [
      R.T,
      (e) => {
        throw e
      },
    ],
  ]) as (reason: unknown) => never
