import * as React from 'react'
import CircularProgress from '@material-ui/core/CircularProgress'
import { withStyles } from '@material-ui/styles'

import * as AWS from 'utils/AWS'
import AsyncResult from 'utils/AsyncResult'
import Data from 'utils/Data'
import * as NamedRoutes from 'utils/NamedRoutes'
import Link from 'utils/StyledLink'
import * as RT from 'utils/reactTools'

import Message from './Message'
import Summary from './Summary'
import { displayError } from './errors'
import * as requests from './requests'

const EXAMPLE_BUCKET = 'quilt-example'

const whenEmpty = (bucket) => () => (
  <NamedRoutes.Inject>
    {({ urls }) => (
      <Message headline="Getting Started">
        Welcome to the Quilt T4 catalog for the <strong>{bucket}</strong> bucket.
        <br />
        For help getting started with T4 check out{' '}
        <Link to={urls.bucketRoot(EXAMPLE_BUCKET)}>the demo bucket</Link>.
        <br />
        To overwrite this landing page with your own, create a new{' '}
        <strong>README.md</strong> at the top level of this bucket.
      </Message>
    )}
  </NamedRoutes.Inject>
)

export default RT.composeComponent(
  'Bucket.Overview',
  withStyles(({ spacing: { unit } }) => ({
    progress: {
      marginTop: 2 * unit,
    },
  })),
  ({
    classes,
    match: {
      params: { bucket },
    },
  }) => (
    <AWS.S3.Inject>
      {(s3) => (
        <Data fetch={requests.bucketListing} params={{ s3, bucket }}>
          {AsyncResult.case({
            Ok: ({ files }) => <Summary files={files} whenEmpty={whenEmpty(bucket)} />,
            Err: displayError(),
            _: () => <CircularProgress className={classes.progress} />,
          })}
        </Data>
      )}
    </AWS.S3.Inject>
  ),
)
