import * as dateFns from 'date-fns'
import * as R from 'ramda'
import * as React from 'react'
import { FormattedRelative, FormattedPlural } from 'react-intl'
import { Link } from 'react-router-dom'
import * as M from '@material-ui/core'
import { fade } from '@material-ui/core/styles'

import Sparkline from 'components/Sparkline'
import AsyncResult from 'utils/AsyncResult'
import * as AWS from 'utils/AWS'
import * as Config from 'utils/Config'
import Data from 'utils/Data'
import Delay from 'utils/Delay'
import * as NamedRoutes from 'utils/NamedRoutes'
import * as SVG from 'utils/SVG'
import { readableQuantity } from 'utils/string'

import { docs } from 'constants/urls'
import Message from './Message'
import { displayError } from './errors'
import * as requests from './requests'

const Counts = ({ analyticsBucket, bucket, name }) => {
  const s3req = AWS.S3.useRequest()
  const today = React.useMemo(() => new Date(), [])
  const [cursor, setCursor] = React.useState(null)
  const t = M.useTheme()
  const xs = M.useMediaQuery(t.breakpoints.down('xs'))
  const sm = M.useMediaQuery(t.breakpoints.down('sm'))
  // eslint-disable-next-line no-nested-ternary
  const sparklineW = xs ? 176 : sm ? 300 : 400
  const sparklineH = xs ? 32 : 40
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
                          width: sparklineW,
                          height: sparklineH,
                        }}
                        data={R.pluck('value', counts)}
                        onCursor={setCursor}
                        width={sparklineW}
                        height={sparklineH}
                        pb={8}
                        pt={5}
                        px={10}
                        extendL
                        extendR
                        stroke={SVG.Paint.Color(M.colors.blue[500])}
                        fill={SVG.Paint.Server(
                          <linearGradient>
                            <stop offset="0" stopColor={fade(M.colors.blue[500], 0)} />
                            <stop
                              offset="30%"
                              stopColor={fade(M.colors.blue[500], 0.3)}
                            />
                          </linearGradient>,
                        )}
                        contourThickness={1.5}
                        cursorLineExtendUp={false}
                        cursorCircleR={3}
                        cursorCircleFill={SVG.Paint.Color(M.colors.common.white)}
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

    [t.breakpoints.down('xs')]: {
      borderRadius: 0,
    },

    [t.breakpoints.up('sm')]: {
      '& + &': {
        marginTop: t.spacing(1),
      },
    },
  },
  handle: {
    fontSize: t.typography.pxToRem(16),
    fontWeight: t.typography.fontWeightMedium,
    lineHeight: t.typography.pxToRem(20),
  },
  handleContainer: {
    WebkitBoxOrient: 'vertical',
    WebkitLineClamp: 2,
    display: '-webkit-box',
    overflow: 'hidden',
    overflowWrap: 'break-word',
    paddingLeft: t.spacing(2),
    paddingRight: t.spacing(21),
    paddingTop: t.spacing(2),
    textOverflow: 'ellipsis',
  },
}))

const Package = ({ name, modified, revisions, revisionsTruncated, bucket }) => {
  const { analyticsBucket } = Config.useConfig()
  const { urls } = NamedRoutes.use()
  const classes = usePackageStyles()
  const t = M.useTheme()
  const xs = M.useMediaQuery(t.breakpoints.down('xs'))
  return (
    <M.Paper className={classes.root}>
      <div className={classes.handleContainer}>
        <Link className={classes.handle} to={urls.bucketPackageDetail(bucket, name)}>
          {name}
        </Link>
      </div>
      <M.Box pl={2} pb={2} pt={1}>
        <M.Typography variant="subtitle2" color="textSecondary" component="span">
          {revisions}
          {revisionsTruncated && '+'}{' '}
          {xs ? (
            'Rev.'
          ) : (
            <FormattedPlural one="Revision" other="Revisions" value={revisions} />
          )}
        </M.Typography>
        <M.Box mr={2} component="span" />
        <M.Typography variant="body2" color="textSecondary" component="span">
          {xs ? 'Upd. ' : 'Updated '}
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
  const t = M.useTheme()
  const xs = M.useMediaQuery(t.breakpoints.down('xs'))
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
            <M.Box pt={2} pb={5} mx={xs ? -2 : 0}>
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
