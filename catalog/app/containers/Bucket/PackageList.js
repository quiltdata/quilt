import * as dateFns from 'date-fns'
import * as R from 'ramda'
import * as React from 'react'
import { FormattedRelative, FormattedPlural } from 'react-intl'
import { Link } from 'react-router-dom'
import * as M from '@material-ui/core'

import Sparkline from 'components/Sparkline'
import AsyncResult from 'utils/AsyncResult'
import * as AWS from 'utils/AWS'
import * as Config from 'utils/Config'
import Data from 'utils/Data'
import Delay from 'utils/Delay'
import * as NamedRoutes from 'utils/NamedRoutes'
import { readableQuantity } from 'utils/string'

import { docs } from 'constants/urls'
import Message from './Message'
import { displayError } from './errors'
import * as requests from './requests'

const Counts = ({ analyticsBucket, bucket, name }) => {
  const s3req = AWS.S3.useRequest()
  const today = React.useMemo(() => new Date(), [])
  const [cursor, setCursor] = React.useState(null)
  return (
    <Data
      fetch={requests.pkgAccessCounts}
      params={{ s3req, analyticsBucket, bucket, name, today }}
    >
      {(res) => (
        <>
          <M.Fade in={AsyncResult.Pending.is(res)}>
            <M.Box position="absolute" right={16} bottom={16}>
              <Delay>
                {() => (
                  <M.Fade in appear>
                    <M.CircularProgress />
                  </M.Fade>
                )}
              </Delay>
            </M.Box>
          </M.Fade>

          <M.Fade in={AsyncResult.Ok.is(res)}>
            <M.Box position="absolute" right={0} top={0} bottom={0}>
              {AsyncResult.case(
                {
                  Ok: ({ counts, total }) => (
                    <>
                      <M.Box
                        position="absolute"
                        right={16}
                        top={16}
                        display="flex"
                        justifyContent="space-between"
                        width={144}
                      >
                        <M.Typography
                          variant="body2"
                          color={cursor === null ? 'textSecondary' : 'textPrimary'}
                          component="span"
                        >
                          Views (
                          {cursor === null
                            ? `${counts.length} days`
                            : dateFns.format(counts[cursor].date, `D MMM`)}
                          ):
                        </M.Typography>
                        <M.Typography
                          variant="subtitle2"
                          color={cursor === null ? 'textSecondary' : 'textPrimary'}
                          component="span"
                        >
                          {readableQuantity(
                            cursor === null ? total : counts[cursor].value,
                          )}
                        </M.Typography>
                      </M.Box>
                      <Sparkline
                        boxProps={{
                          position: 'absolute',
                          right: 0,
                          bottom: 0,
                          width: 320,
                          height: 40,
                        }}
                        data={R.pluck('value', counts)}
                        onCursor={setCursor}
                        width={320}
                        height={40}
                        color={M.colors.blue[100]}
                        color2={M.colors.blue[800]}
                      />
                    </>
                  ),
                  _: () => null,
                },
                res,
              )}
            </M.Box>
          </M.Fade>
        </>
      )}
    </Data>
  )
}

const usePackageStyles = M.makeStyles((t) => ({
  root: {
    position: 'relative',

    '& + &': {
      marginTop: t.spacing(1),
    },
  },
}))

const Package = ({ name, modified, revisions, revisionsTruncated, bucket }) => {
  const { analyticsBucket } = Config.useConfig()
  const { urls } = NamedRoutes.use()
  const classes = usePackageStyles()
  return (
    <M.Paper className={classes.root}>
      <M.Box pl={2} pt={2}>
        <M.Typography
          variant="h6"
          component={Link}
          to={urls.bucketPackageDetail(bucket, name)}
        >
          {name}
        </M.Typography>
      </M.Box>
      <M.Box pl={2} pb={2} pt={1}>
        <M.Typography variant="subtitle2" color="textSecondary" component="span">
          {revisions}
          {revisionsTruncated && '+'}{' '}
          <FormattedPlural one="Revision" other="Revisions" value={revisions} />
        </M.Typography>
        <M.Box mr={2} component="span" />
        <M.Typography variant="body2" color="textSecondary" component="span">
          Updated{' '}
          {modified ? <FormattedRelative value={modified} /> : '[unknown: see console]'}
        </M.Typography>
      </M.Box>
      {!!analyticsBucket && <Counts {...{ analyticsBucket, bucket, name }} />}
    </M.Paper>
  )
}

export default ({
  match: {
    params: { bucket },
  },
}) => {
  const s3req = AWS.S3.useRequest()
  return (
    <Data fetch={requests.listPackages} params={{ s3req, bucket }}>
      {AsyncResult.case({
        _: () => (
          <M.Box display="flex" pt={5} justifyContent="center">
            <M.CircularProgress />
          </M.Box>
        ),
        Err: displayError(),
        Ok: (pkgs) =>
          pkgs.length ? (
            <M.Box pt={2} pb={5}>
              {pkgs.map((pkg) => (
                <Package key={pkg.name} {...pkg} bucket={bucket} />
              ))}
            </M.Box>
          ) : (
            <Message headline="No packages">
              <Link href={`${docs}/walkthrough/`}>Learn how to create a package</Link> .
            </Message>
          ),
      })}
    </Data>
  )
}
