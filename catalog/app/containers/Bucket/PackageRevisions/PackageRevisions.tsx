import * as dateFns from 'date-fns'
import * as R from 'ramda'
import * as React from 'react'
import * as RRDom from 'react-router-dom'
import type { ResultOf } from '@graphql-typed-document-node/core'
import * as M from '@material-ui/core'
import { fade } from '@material-ui/core/styles'

import JsonDisplay from 'components/JsonDisplay'
import Skeleton from 'components/Skeleton'
import Sparkline from 'components/Sparkline'
import * as BucketPreferences from 'utils/BucketPreferences'
import MetaTitle from 'utils/MetaTitle'
import * as NamedRoutes from 'utils/NamedRoutes'
import * as SVG from 'utils/SVG'
import StyledLink from 'utils/StyledLink'
import copyToClipboard from 'utils/clipboard'
import * as Format from 'utils/format'
import parseSearch from 'utils/parseSearch'
import { readableBytes, readableQuantity } from 'utils/string'
import usePrevious from 'utils/usePrevious'
import useQuery from 'utils/useQuery'

import * as PD from '../PackageDialog'
import Pagination from '../Pagination'
import WithPackagesSupport from '../WithPackagesSupport'
import { displayError } from '../errors'

import REVISION_COUNT_QUERY from './gql/RevisionCount.generated'
import REVISION_LIST_QUERY from './gql/RevisionList.generated'

const PER_PAGE = 30

type RevisionFields = NonNullable<
  NonNullable<
    ResultOf<typeof REVISION_LIST_QUERY>['package']
  >['revisions']['page'][number]
>

type AccessCounts = NonNullable<RevisionFields['accessCounts']>

interface SparklineSkelProps {
  width: number
  height: number
}

function SparklineSkel({ width, height }: SparklineSkelProps) {
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

interface CountsProps {
  sparklineW: number
  sparklineH: number
}

function Counts({ counts, total, sparklineW, sparklineH }: CountsProps & AccessCounts) {
  const [cursor, setCursor] = React.useState<number | null>(null)
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
            : dateFns.format(counts[cursor].date, `MMM do`)}
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

const useRevisionLayoutStyles = M.makeStyles((t) => ({
  root: {
    position: 'relative',

    [t.breakpoints.down('xs')]: {
      borderRadius: 0,
    },

    [t.breakpoints.up('sm')]: {
      marginTop: t.spacing(1),
    },
  },
}))

interface RevisionLayoutProps {
  link: React.ReactNode
  msg: React.ReactNode
  meta?: React.ReactNode
  hash: React.ReactNode
  stats: React.ReactNode
  counts: (props: CountsProps) => React.ReactNode
}

function RevisionLayout({ link, msg, meta, hash, stats, counts }: RevisionLayoutProps) {
  const classes = useRevisionLayoutStyles()
  const t = M.useTheme()
  const xs = M.useMediaQuery(t.breakpoints.down('xs'))
  const sm = M.useMediaQuery(t.breakpoints.down('sm'))
  // eslint-disable-next-line no-nested-ternary
  const sparklineW = xs ? 176 : sm ? 300 : 400
  const sparklineH = xs ? 32 : 48
  return (
    <M.Paper className={classes.root}>
      <M.Box pt={2} pl={2} pr={25}>
        {link}
      </M.Box>
      <M.Box py={1} pl={2} pr={xs ? 2 : Math.ceil(sparklineW / t.spacing(1) + 1)}>
        {msg}
      </M.Box>
      {!!meta && (
        <M.Hidden xsDown>
          <M.Divider />
          {meta}
        </M.Hidden>
      )}
      <M.Hidden xsDown>
        <M.Divider />
      </M.Hidden>
      <M.Box
        pl={2}
        pr={xs ? Math.ceil(sparklineW / t.spacing(1)) : 30}
        height={{ xs: 64, sm: 48 }}
        display="flex"
        alignItems="center"
      >
        {hash}
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
        {stats}
      </M.Box>
      <M.Box
        position="absolute"
        right={0}
        bottom={{ xs: 0, sm: 49 }}
        top={{ xs: 'auto', sm: 16 }}
        height={{ xs: 64, sm: 'auto' }}
        width={sparklineW}
      >
        {counts({ sparklineW, sparklineH })}
      </M.Box>
    </M.Paper>
  )
}

function RevisionSkel() {
  const t = M.useTheme()
  const xs = M.useMediaQuery(t.breakpoints.down('xs'))
  return (
    <RevisionLayout
      link={
        <M.Box height={20} display="flex" alignItems="center">
          <Skeleton borderRadius="borderRadius" height={16} width={200} />
        </M.Box>
      }
      msg={
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
      }
      hash={
        <Skeleton borderRadius="borderRadius" height={16} width="100%" maxWidth={550} />
      }
      stats={
        <M.Box display="flex" alignItems="center">
          <Skeleton borderRadius="borderRadius" width={70} height={16} mr={2} />
          <Skeleton borderRadius="borderRadius" width={70} height={16} />
        </M.Box>
      }
      counts={({ sparklineW, sparklineH }) => (
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
      )}
    />
  )
}

const useRevisionStyles = M.makeStyles((t) => ({
  mono: {
    // @ts-expect-error
    fontFamily: t.typography.monospace.fontFamily,
  },
  time: {
    ...t.typography.body1,
    fontWeight: t.typography.fontWeightMedium,
    lineHeight: t.typography.pxToRem(20),
    whiteSpace: 'nowrap',
  },
  msg: {
    ...(t.mixins as $TSFixMe).lineClamp(2),
    overflowWrap: 'break-word',
    [t.breakpoints.up('sm')]: {
      minHeight: 40,
    },
  },
  hash: {
    color: t.palette.text.secondary,
    // @ts-expect-error
    fontFamily: t.typography.monospace.fontFamily,
    fontSize: t.typography.body2.fontSize,
    maxWidth: 'calc(100% - 48px)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
}))

interface RevisionProps extends RevisionFields {
  bucket: string
  name: string
}

function Revision({
  bucket,
  name,
  hash,
  modified,
  message,
  userMeta,
  totalEntries,
  totalBytes,
  accessCounts,
}: RevisionProps) {
  const classes = useRevisionStyles()
  const { urls } = NamedRoutes.use()
  const t = M.useTheme()
  const xs = M.useMediaQuery(t.breakpoints.down('xs'))
  const dateFmt = xs ? 'MMM d yyyy - h:mmaaaaa' : 'MMMM do yyyy - h:mma'

  return (
    <RevisionLayout
      link={
        <RRDom.Link
          className={classes.time}
          to={urls.bucketPackageTree(bucket, name, hash)}
        >
          {dateFns.format(modified, dateFmt)}
        </RRDom.Link>
      }
      msg={
        <M.Typography variant="body2" className={classes.msg}>
          {message || <i>No message</i>}
        </M.Typography>
      }
      meta={
        !!userMeta &&
        !R.isEmpty(userMeta) && (
          // @ts-expect-error
          <JsonDisplay name="Metadata" value={userMeta} pl={1.5} py={1.75} pr={2} />
        )
      }
      hash={
        <>
          <M.Box className={classes.hash} component="span" order={{ xs: 1, sm: 0 }}>
            {hash}
          </M.Box>
          <M.IconButton onClick={() => copyToClipboard(hash)} edge={xs ? 'start' : false}>
            <M.Icon>file_copy</M.Icon>
          </M.IconButton>
        </>
      }
      stats={
        <>
          <M.Icon color="disabled">storage</M.Icon>
          &nbsp;&nbsp;
          <M.Typography component="span" variant="body2">
            {readableBytes(totalBytes)}
          </M.Typography>
          <M.Box pr={2} />
          <M.Icon color="disabled">insert_drive_file</M.Icon>
          &nbsp;
          <M.Typography component="span" variant="body2">
            {readableQuantity(totalEntries)}
            &nbsp;
            <Format.Plural value={totalEntries ?? 0} one="file" other="files" />
          </M.Typography>
        </>
      }
      counts={({ sparklineW, sparklineH }) =>
        !!accessCounts && <Counts {...{ sparklineW, sparklineH, ...accessCounts }} />
      }
    />
  )
}

const renderRevisionSkeletons = R.times((i) => <RevisionSkel key={i} />)

interface PackageRevisionsProps {
  bucket: string
  name: string
  page?: number
}

export function PackageRevisions({ bucket, name, page }: PackageRevisionsProps) {
  const preferences = BucketPreferences.use()
  const { urls } = NamedRoutes.use()

  const actualPage = page || 1

  const makePageUrl = React.useCallback(
    (newP: number) =>
      urls.bucketPackageRevisions(bucket, name, { p: newP !== 1 ? newP : undefined }),
    [urls, bucket, name],
  )

  const scrollRef = React.useRef<HTMLSpanElement>(null)

  // scroll to top on page change
  usePrevious(actualPage, (prev) => {
    if (prev && actualPage !== prev && scrollRef.current) {
      scrollRef.current.scrollIntoView()
    }
  })

  const revisionCountQuery = useQuery({
    query: REVISION_COUNT_QUERY,
    variables: { bucket, name },
  })
  const revisionListQuery = useQuery({
    query: REVISION_LIST_QUERY,
    variables: { bucket, name, page: actualPage, perPage: PER_PAGE },
  })

  const updateDialog = PD.usePackageCreationDialog({ bucket, src: { name } })

  return (
    <M.Box pb={{ xs: 0, sm: 5 }} mx={{ xs: -2, sm: 0 }}>
      {updateDialog.render({
        resetFiles: 'Undo changes',
        submit: 'Push',
        successBrowse: 'Browse',
        successTitle: 'Push complete',
        successRenderMessage: ({ packageLink }) => (
          <>Package revision {packageLink} successfully created</>
        ),
        title: 'Push package revision',
      })}

      <M.Box
        pt={{ xs: 2, sm: 3 }}
        pb={{ xs: 2, sm: 1 }}
        px={{ xs: 2, sm: 0 }}
        display="flex"
      >
        <M.Typography variant="h5" ref={scrollRef}>
          <StyledLink to={urls.bucketPackageDetail(bucket, name)}>{name}</StyledLink>{' '}
          revisions
        </M.Typography>
        <M.Box flexGrow={1} />
        {preferences?.ui?.actions?.revisePackage && (
          <M.Button
            variant="contained"
            color="primary"
            style={{ marginTop: -3, marginBottom: -3 }}
            onClick={updateDialog.open}
          >
            Revise package
          </M.Button>
        )}
      </M.Box>

      {revisionCountQuery.case({
        error: displayError(),
        fetching: () => renderRevisionSkeletons(10),
        data: (d) => {
          const revisionCount = d.package?.revisions.total
          if (!revisionCount) {
            return (
              <M.Box py={5} textAlign="center">
                <M.Typography variant="h4">No such package</M.Typography>
              </M.Box>
            )
          }

          const pages = Math.ceil(revisionCount / PER_PAGE)

          return (
            <>
              {revisionListQuery.case({
                error: displayError(),
                fetching: () => {
                  const items = actualPage < pages ? PER_PAGE : revisionCount % PER_PAGE
                  return renderRevisionSkeletons(items)
                },
                data: (dd) =>
                  (dd.package?.revisions.page || []).map((r) => (
                    <Revision
                      key={`${r.hash}:${r.modified.valueOf()}`}
                      {...{ bucket, name, ...r }}
                    />
                  )),
              })}
              {pages > 1 && <Pagination {...{ pages, page: actualPage, makePageUrl }} />}
            </>
          )
        },
      })}
    </M.Box>
  )
}

export default function PackageRevisionsWrapper({
  match: {
    params: { bucket, name },
  },
  location,
}: RRDom.RouteComponentProps<{ bucket: string; name: string }>) {
  const { p } = parseSearch(location.search, true)
  const page = p ? parseInt(p, 10) : undefined
  return (
    <>
      <MetaTitle>{[name, bucket]}</MetaTitle>
      <WithPackagesSupport bucket={bucket}>
        <PackageRevisions {...{ bucket, name, page }} />
      </WithPackagesSupport>
    </>
  )
}

// TODO: restore linked data
/*
{!!bucketCfg &&
  AsyncResult.case(
    {
      _: () => null,
      Ok: ({ hash, modified, header }) => (
        <React.Suspense fallback={null}>
          <LinkedData.PackageData
            {...{
              bucket: bucketCfg,
              name,
              revision: r,
              hash,
              modified,
              header,
            }}
          />
        </React.Suspense>
      ),
    },
    res,
  )}
*/
