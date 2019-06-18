import * as dateFns from 'date-fns'
import * as R from 'ramda'
import * as React from 'react'
import { Link } from 'react-router-dom'
import {
  Card,
  CardContent,
  CircularProgress,
  Typography,
  colors,
} from '@material-ui/core'
import { unstable_Box as Box } from '@material-ui/core/Box'
import { makeStyles, withStyles } from '@material-ui/styles'

import Sparkline from 'components/Sparkline'
import AsyncResult from 'utils/AsyncResult'
import * as AWS from 'utils/AWS'
import * as Config from 'utils/Config'
import Data from 'utils/Data'
import * as NamedRoutes from 'utils/NamedRoutes'
import * as RT from 'utils/reactTools'
import { readableQuantity } from 'utils/string'

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

const Counts = ({ analyticsBucket, bucket, name, hash }) => {
  const s3 = AWS.S3.use()
  const today = React.useMemo(() => new Date(), [])
  const [cursor, setCursor] = React.useState(null)
  return (
    <Data
      fetch={requests.pkgVersionAccessCounts}
      params={{ s3, analyticsBucket, bucket, name, hash, today }}
    >
      {AsyncResult.case({
        Ok: ({ counts, total }) => (
          <Box width={200}>
            <Box
              display="flex"
              justifyContent="space-between"
              fontSize="body1.fontSize"
              fontWeight="fontWeightMedium"
              style={{ lineHeight: 1.5 }}
            >
              <Box>
                Views (
                {cursor === null
                  ? `${counts.length} days`
                  : dateFns.format(counts[cursor].date, `D MMM`)}
                ):
              </Box>
              <Box>
                {readableQuantity(cursor === null ? total : counts[cursor].value)}
              </Box>
            </Box>
            <Box height={16} mt={1} width="100%">
              <Sparkline
                data={R.pluck('value', counts)}
                onCursor={setCursor}
                width={200}
                height={16}
                color={colors.blueGrey[100]}
                color2={colors.blueGrey[800]}
                fill={false}
              />
            </Box>
          </Box>
        ),
        Pending: () => <CircularProgress />,
        _: () => null,
      })}
    </Data>
  )
}

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
  const { apiGatewayEndpoint: endpoint, analyticsBucket } = Config.useConfig()
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
                    <Box
                      display="flex"
                      flexWrap="wrap"
                      justifyContent="space-between"
                      alignItems="center"
                    >
                      <Box>
                        <Field label="Message:">{info.message || '<empty>'}</Field>
                        <Field label="Date:">{modified.toLocaleString()}</Field>
                        <Field label="Hash:">{hash}</Field>
                      </Box>
                      {!!analyticsBucket && (
                        <Counts {...{ analyticsBucket, bucket, name, hash }} />
                      )}
                    </Box>
                  </CardContent>
                </Card>
              ),
          ),
        })}
      </Data>
    </>
  )
}
