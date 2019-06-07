import * as dateFns from 'date-fns'
import * as R from 'ramda'
import * as React from 'react'
import {
  Box,
  Card,
  CardContent,
  CircularProgress,
  Typography,
  colors,
} from '@material-ui/core'

import Sparkline from 'components/Sparkline'
import AsyncResult from 'utils/AsyncResult'
import * as AWS from 'utils/AWS'
import * as Config from 'utils/Config'
import Data from 'utils/Data'
import * as NamedRoutes from 'utils/NamedRoutes'
import Link from 'utils/StyledLink'
import { readableQuantity } from 'utils/string'

import Message from './Message'
import { displayError } from './errors'
import * as requests from './requests'

const Counts = ({ bucket, name }) => {
  const s3 = AWS.S3.use()
  const { analyticsBucket } = Config.useConfig()
  const today = React.useMemo(() => new Date(), [])
  const [cursor, setCursor] = React.useState(null)
  return (
    <Data
      fetch={requests.pkgAccessCounts}
      params={{ s3, analyticsBucket, bucket, name, today }}
    >
      {AsyncResult.case({
        Ok: ({ counts, total }) => (
          <Box width={168}>
            <Box
              display="flex"
              justifyContent="space-between"
              fontSize="body1.fontSize"
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
                width={168}
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

export default ({
  match: {
    params: { bucket },
  },
}) => {
  const s3 = AWS.S3.use()
  const { urls } = NamedRoutes.use()
  return (
    <Data fetch={requests.listPackages} params={{ s3, bucket }}>
      {AsyncResult.case({
        _: () => <CircularProgress />,
        Err: displayError(),
        Ok: R.ifElse(
          R.isEmpty,
          () => (
            <Message headline="No packages">
              <Link href="https://quiltdocs.gitbook.io/t4/walkthrough/creating-a-package">
                Learn how to create a package
              </Link>
              .
            </Message>
          ),
          R.pipe(
            R.map(({ name, revisions: { latest: { modified } } }) => (
              <Box component={Card} key={name} mt={1}>
                <CardContent>
                  <Box display="flex" justifyContent="space-between">
                    <Box>
                      <Typography variant="h5">
                        <Link to={urls.bucketPackageDetail(bucket, name)}>{name}</Link>
                      </Typography>
                      <Typography variant="body1">
                        Updated on {modified.toLocaleString()}
                      </Typography>
                    </Box>
                    <Counts {...{ bucket, name }} />
                  </Box>
                </CardContent>
              </Box>
            )),
            (content) => (
              <Box mx="auto" maxWidth={800}>
                {content}
              </Box>
            ),
          ),
        ),
      })}
    </Data>
  )
}
