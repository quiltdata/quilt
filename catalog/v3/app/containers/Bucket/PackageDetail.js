import * as R from 'ramda'
import * as React from 'react'
import { Link } from 'react-router-dom'
import Card from '@material-ui/core/Card'
import CardContent from '@material-ui/core/CardContent'
import CircularProgress from '@material-ui/core/CircularProgress'
import Typography from '@material-ui/core/Typography'
import { makeStyles, withStyles } from '@material-ui/styles'

import AsyncResult from 'utils/AsyncResult'
import * as AWS from 'utils/AWS'
import * as Config from 'utils/Config'
import Data from 'utils/Data'
import * as NamedRoutes from 'utils/NamedRoutes'
import * as RT from 'utils/reactTools'

import { displayError } from './errors'
import * as requests from './requests'

const Field = RT.composeComponent(
  'Bucket.PackageDetail.Field',
  withStyles(({ typography }) => ({
    root: {
      display: 'flex',
    },
    label: {
      fontWeight: typography.fontWeightMedium,
      width: 80,
    },
    value: {},
  })),
  ({ classes, label, children }) => (
    <Typography variant="body1" className={classes.root}>
      <span className={classes.label}>{label}</span>
      <span className={classes.value}>{children}</span>
    </Typography>
  ),
)

const useStyles = makeStyles(({ spacing: { unit }, palette }) => ({
  card: {
    marginTop: unit,
  },
  link: {
    display: 'block',
    '&:hover': {
      background: palette.action.hover,
    },
  },
}))

export default ({
  match: {
    params: { bucket, name },
  },
}) => {
  const { urls } = NamedRoutes.use()
  const classes = useStyles()
  const s3 = AWS.S3.use()
  const signer = AWS.Signer.use()
  const { apiGatewayEndpoint: endpoint } = Config.useConfig()

  return (
    <>
      <Typography variant="h4">{name}: revisions</Typography>
      <Data
        fetch={requests.getPackageRevisions}
        params={{ s3, signer, endpoint, bucket, name }}
      >
        {AsyncResult.case({
          _: () => <CircularProgress />,
          Err: displayError(),
          Ok: R.map(
            ({ id, hash, modified, info }) =>
              id !== 'latest' && (
                <Card key={id} className={classes.card}>
                  <CardContent
                    component={Link}
                    className={classes.link}
                    to={urls.bucketPackageTree(bucket, name, id)}
                  >
                    <Field label="Message:">{info.commit_message || '<empty>'}</Field>
                    <Field label="Date:">{modified.toLocaleString()}</Field>
                    <Field label="Hash:">{hash}</Field>
                  </CardContent>
                </Card>
              ),
          ),
        })}
      </Data>
    </>
  )
}
