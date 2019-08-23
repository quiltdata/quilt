import * as dateFns from 'date-fns'
import * as R from 'ramda'
import * as React from 'react'
import { FormattedPlural } from 'react-intl'
import { Link } from 'react-router-dom'
import * as M from '@material-ui/core'
import { fade } from '@material-ui/core/styles'

import Skeleton from 'components/Skeleton'
import Sparkline from 'components/Sparkline'
import AsyncResult from 'utils/AsyncResult'
import * as AWS from 'utils/AWS'
import * as Config from 'utils/Config'
import Data from 'utils/Data'
import * as NamedRoutes from 'utils/NamedRoutes'
import * as SVG from 'utils/SVG'
import copyToClipboard from 'utils/clipboard'
import parseSearch from 'utils/parseSearch'
import { readableBytes, readableQuantity } from 'utils/string'
import usePrevious from 'utils/usePrevious'

import Pagination from './Pagination'
import { displayError } from './errors'
import * as requests from './requests'

const SparklineSkel = ({ width, height }) => {
  const [data] = React.useState(() => R.times((i) => i + Math.random() * i, 30))
  const t = M.useTheme()
  const c0 = fade(t.palette.action.hover, 0)
  const c1 = t.palette.action.hover
  const c2 = fade(t.palette.action.hover, t.palette.action.hoverOpacity * 0.4)
  return (
    <Sparkline
      boxProps={{
        position: 'absolute',
        right: 0,
        bottom: 0,
        width,
        height,
      }}
      data={data}
      width={width}
      height={height}
      pb={8}
      pt={5}
      px={10}
      extendL
      extendR
      stroke={SVG.Paint.Color(t.palette.action.hover)}
      fill={SVG.Paint.Server(
        <linearGradient>
          <stop offset="0" stopColor={c0} />
          <stop offset="30%" stopColor={c1}>
            <animate
              attributeName="stop-color"
              values={`${c1}; ${c2}; ${c1}`}
              dur="3s"
              repeatCount="indefinite"
            />
          </stop>
        </linearGradient>,
      )}
      contourThickness={1.5}
    />
  )
}

const Counts = ({ counts, total, sparklineW, sparklineH }) => {
  const [cursor, setCursor] = React.useState(null)
  return (
    <>
      <M.Box position="absolute" right={16} top={0}>
        <M.Typography
          variant="body2"
          color={cursor === null ? 'textSecondary' : 'textPrimary'}
          component="span"
          noWrap
        >
          {cursor === null
            ? 'Total views'
            : dateFns.format(counts[cursor].date, `MMM Do`)}
          :
        </M.Typography>
        <M.Box
          component="span"
          textAlign="right"
          ml={1}
          minWidth={30}
          display="inline-block"
        >
          <M.Typography
            variant="subtitle2"
            color={cursor === null ? 'textSecondary' : 'textPrimary'}
            component="span"
          >
            {readableQuantity(cursor === null ? total : counts[cursor].value)}
          </M.Typography>
        </M.Box>
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
            <stop offset="30%" stopColor={fade(M.colors.blue[500], 0.3)} />
          </linearGradient>,
        )}
        contourThickness={1.5}
        cursorLineExtendUp={false}
        cursorCircleR={3}
        cursorCircleFill={SVG.Paint.Color(M.colors.common.white)}
      />
    </>
  )
}

const useRevisionStyles = M.makeStyles((t) => ({
  root: {
    position: 'relative',

    [t.breakpoints.down('xs')]: {
      borderRadius: 0,
    },

    [t.breakpoints.up('sm')]: {
      marginTop: t.spacing(1),
    },
  },
  time: {
    ...t.typography.body1,
    fontWeight: t.typography.fontWeightMedium,
    lineHeight: t.typography.pxToRem(20),
    whiteSpace: 'nowrap',
  },
  msg: {
    WebkitBoxOrient: 'vertical',
    WebkitLineClamp: 2,
    display: '-webkit-box',
    overflow: 'hidden',
    overflowWrap: 'break-word',
    textOverflow: 'ellipsis',
    [t.breakpoints.up('sm')]: {
      minHeight: 40,
    },
  },
  hash: {
    color: t.palette.text.secondary,
    fontFamily: t.typography.monospace.fontFamily,
    fontSize: t.typography.body2.fontSize,
    maxWidth: 'calc(100% - 48px)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
}))

const Revision = ({ bucket, name, id, hash, stats, message, counts }) => {
  const classes = useRevisionStyles()
  const { urls } = NamedRoutes.use()
  const t = M.useTheme()
  const xs = M.useMediaQuery(t.breakpoints.down('xs'))
  const sm = M.useMediaQuery(t.breakpoints.down('sm'))
  // eslint-disable-next-line no-nested-ternary
  const sparklineW = xs ? 176 : sm ? 300 : 400
  const sparklineH = xs ? 32 : 48
  const dateFmt = xs ? 'MMM D YYYY - h:mma' : 'MMMM Do YYYY - h:mmA'
  return (
    <M.Paper className={classes.root}>
      <M.Box pt={2} pl={2} pr={25}>
        {AsyncResult.case(
          {
            Ok: (v) => {
              const modified = new Date(parseInt(v, 10) * 1000)
              return (
                <Link
                  className={classes.time}
                  to={urls.bucketPackageTree(bucket, name, v)}
                >
                  {dateFns.format(modified, dateFmt)}
                </Link>
              )
            },
            _: () => (
              <M.Box height={20} display="flex" alignItems="center">
                <Skeleton borderRadius="borderRadius" height={16} width={200} />
              </M.Box>
            ),
          },
          id,
        )}
      </M.Box>
      <M.Box py={1} pl={2} pr={{ xs: 2, sm: Math.ceil(sparklineW / 8 + 1) }}>
        {AsyncResult.case(
          {
            Ok: (v) => (
              <M.Typography variant="body2" className={classes.msg}>
                {v || <i>No message</i>}
              </M.Typography>
            ),
            _: () => (
              <>
                <M.Box height={20} display="flex" alignItems="center">
                  <Skeleton borderRadius="borderRadius" height={16} width="100%" />
                </M.Box>
                {!xs && (
                  <M.Box height={20} display="flex" alignItems="center">
                    <Skeleton borderRadius="borderRadius" height={16} width="90%" />
                  </M.Box>
                )}
              </>
            ),
          },
          message,
        )}
      </M.Box>
      <M.Hidden xsDown>
        <M.Divider />
      </M.Hidden>
      <M.Box
        pl={2}
        pr={{ xs: Math.ceil(sparklineW / 8 + 1), sm: 25 }}
        height={{ xs: 64, sm: 48 }}
        display="flex"
        alignItems="center"
      >
        {AsyncResult.case(
          {
            Ok: (v) => (
              <>
                <M.Box className={classes.hash} component="span" order={{ xs: 1, sm: 0 }}>
                  {v}
                </M.Box>
                <M.IconButton
                  onClick={() => copyToClipboard(v)}
                  edge={xs ? 'start' : false}
                >
                  <M.Icon>file_copy</M.Icon>
                </M.IconButton>
              </>
            ),
            _: () => (
              <Skeleton
                borderRadius="borderRadius"
                height={16}
                width="100%"
                maxWidth={550}
              />
            ),
          },
          hash,
        )}
      </M.Box>
      <M.Box
        position="absolute"
        right={16}
        bottom={{ xs: 'auto', sm: 0 }}
        top={{ xs: 16, sm: 'auto' }}
        height={{ xs: 20, sm: 48 }}
        display="flex"
        alignItems="center"
        color="text.secondary"
      >
        {AsyncResult.case(
          {
            Ok: ({ files, bytes, truncated }) => (
              <>
                <M.Icon color="disabled">storage</M.Icon>
                &nbsp;&nbsp;
                <M.Typography component="span" variant="body2">
                  {readableBytes(bytes, truncated && '+')}
                </M.Typography>
                <M.Box pr={2} />
                <M.Icon color="disabled">insert_drive_file</M.Icon>
                &nbsp;
                <M.Typography component="span" variant="body2">
                  {readableQuantity(files)}
                  {truncated && '+'}
                  &nbsp;
                  <FormattedPlural value={files} one="file" other="files" />
                </M.Typography>
              </>
            ),
            _: () => (
              <M.Box display="flex" alignItems="center">
                <Skeleton borderRadius="borderRadius" width={70} height={16} mr={2} />
                <Skeleton borderRadius="borderRadius" width={70} height={16} />
              </M.Box>
            ),
          },
          stats,
        )}
      </M.Box>
      <M.Box
        position="absolute"
        right={0}
        bottom={{ xs: 0, sm: 49 }}
        top={{ xs: 'auto', sm: 16 }}
        height={{ xs: 64, sm: 'auto' }}
        width={sparklineW}
      >
        {AsyncResult.case(
          {
            Ok: (v) => v && <Counts {...v} {...{ sparklineW, sparklineH }} />,
            _: () => (
              <>
                <M.Box
                  position="absolute"
                  right={16}
                  top={0}
                  display="flex"
                  alignItems="center"
                  height={20}
                  width={120}
                >
                  <Skeleton height={16} width="100%" borderRadius="borderRadius" />
                </M.Box>
                <SparklineSkel width={sparklineW} height={sparklineH} />
              </>
            ),
          },
          counts,
        )}
      </M.Box>
    </M.Paper>
  )
}

const PER_PAGE = 30

const Revisions = ({ revisions, counts, bucket, name, page }) => {
  const { urls } = NamedRoutes.use()
  const { apiGatewayEndpoint: endpoint } = Config.useConfig()
  const signer = AWS.Signer.use()
  const s3req = AWS.S3.useRequest()

  const actualPage = page || 1

  const makePageUrl = React.useCallback(
    (p) => urls.bucketPackageDetail(bucket, name, { p: p !== 1 ? p : undefined }),
    [bucket, name],
  )

  const pages = Math.ceil(revisions.length / PER_PAGE)
  const paginated = React.useMemo(
    () =>
      pages === 1
        ? revisions
        : revisions.slice((actualPage - 1) * PER_PAGE, actualPage * PER_PAGE),
    [revisions, actualPage],
  )

  const scrollRef = React.useRef()
  usePrevious(actualPage, (prev) => {
    if (prev && actualPage !== prev && scrollRef.current) {
      scrollRef.current.scrollIntoView()
    }
  })

  return (
    <M.Box pb={{ xs: 0, sm: 5 }} mx={{ xs: -2, sm: 0 }}>
      <div ref={scrollRef} />
      {paginated.map(({ id, key }) => (
        <Data
          key={id}
          fetch={requests.getRevisionData}
          params={{ s3req, signer, endpoint, bucket, key }}
        >
          {(res) => (
            <Revision
              {...{ bucket, name }}
              id={AsyncResult.Ok(id)}
              {...AsyncResult.props(['hash', 'stats', 'message'], res)}
              counts={AsyncResult.mapCase({ Ok: ({ hash }) => counts[hash] }, res)}
            />
          )}
        </Data>
      ))}
      {pages > 1 && <Pagination {...{ pages, page: actualPage, makePageUrl }} />}
    </M.Box>
  )
}

const pendingProps = AsyncResult.props(
  ['id', 'hash', 'stats', 'message', 'counts'],
  AsyncResult.Pending(),
)

export default ({
  match: {
    params: { bucket, name },
  },
  location,
}) => {
  const { p } = parseSearch(location.search)
  const page = p && parseInt(p, 10)
  const s3req = AWS.S3.useRequest()
  const { analyticsBucket } = Config.useConfig()
  const today = React.useMemo(() => new Date(), [])
  return (
    <>
      <M.Box pt={{ xs: 2, sm: 3 }} pb={2}>
        <M.Typography variant="h5">{name}</M.Typography>
      </M.Box>
      <Data
        fetch={requests.getPackageRevisions}
        params={{ s3req, analyticsBucket, bucket, name, today }}
      >
        {AsyncResult.case({
          _: () => (
            <M.Box pb={{ xs: 0, sm: 5 }} mx={{ xs: -2, sm: 0 }}>
              {R.times(
                (i) => (
                  <Revision key={i} {...{ bucket, name }} {...pendingProps} />
                ),
                5,
              )}
            </M.Box>
          ),
          Err: displayError(),
          Ok: (res) => <Revisions {...res} {...{ bucket, name, page }} />,
        })}
      </Data>
    </>
  )
}
