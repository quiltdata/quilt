import * as dateFns from 'date-fns'
import invariant from 'invariant'
import * as R from 'ramda'
import * as React from 'react'
import * as RRDom from 'react-router-dom'
import type { ResultOf } from '@graphql-typed-document-node/core'
import * as M from '@material-ui/core'
import { fade } from '@material-ui/core/styles'

import * as Buttons from 'components/Buttons'
import JsonDisplay from 'components/JsonDisplay'
import * as Column from 'components/Layout/Column'
import Skeleton from 'components/Skeleton'
import Sparkline from 'components/Sparkline'
import * as BucketPreferences from 'utils/BucketPreferences'
import * as GQL from 'utils/GraphQL'
import MetaTitle from 'utils/MetaTitle'
import * as NamedRoutes from 'utils/NamedRoutes'
import * as SVG from 'utils/SVG'
import StyledLink from 'utils/StyledLink'
import copyToClipboard from 'utils/clipboard'
import * as Format from 'utils/format'
import * as packageHandleUtils from 'utils/packageHandle'
import parseSearch from 'utils/parseSearch'
import { readableBytes, readableQuantity } from 'utils/string'
import usePrevious from 'utils/usePrevious'

import * as PD from '../PackageDialog'
import Pagination from '../Pagination'
import RevisionDeleteDialog from '../PackageTree/RevisionDeleteDialog'
import WithPackagesSupport from '../WithPackagesSupport'
import { displayError } from '../errors'

import REVISION_COUNT_QUERY from './gql/RevisionCount.generated'
import REVISION_LIST_QUERY from './gql/RevisionList.generated'
import { useBulkDelete } from './useBulkDelete'

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

    [Column.down('xs')]: {
      borderRadius: 0,
    },

    [Column.up('sm')]: {
      marginTop: t.spacing(1),
    },
  },
  base: {
    [Column.up('sm')]: {
      position: 'relative',
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
  const xs = Column.useDown('xs')
  const sm = Column.useDown('sm')
  // eslint-disable-next-line no-nested-ternary
  const sparklineW = xs ? 176 : sm ? 300 : 400
  const sparklineH = xs ? 32 : 48
  return (
    <M.Paper className={classes.root}>
      <div className={classes.base}>
        <M.Box pt={2} pl={2} pr={25}>
          {link}
        </M.Box>
        <M.Box py={1} pl={2} pr={xs ? 2 : Math.ceil(sparklineW / t.spacing(1) + 1)}>
          {msg}
        </M.Box>
        <M.Box
          position="absolute"
          right={0}
          bottom={0}
          top={xs ? 'auto' : 16}
          height={xs ? 64 : 'auto'}
          width={sparklineW}
        >
          {counts({ sparklineW, sparklineH })}
        </M.Box>
      </div>
      {!!meta && !xs && (
        <>
          <M.Divider />
          {meta}
        </>
      )}
      {!xs && <M.Divider />}
      <M.Box
        pl={2}
        pr={xs ? Math.ceil(sparklineW / t.spacing(1)) : 30}
        height={xs ? 64 : 48}
        display="flex"
        alignItems="center"
      >
        {hash}
      </M.Box>
      <M.Box
        position="absolute"
        right={16}
        bottom={xs ? 'auto' : 0}
        top={xs ? 16 : 'auto'}
        height={xs ? 20 : 48}
        display="flex"
        alignItems="center"
        color="text.secondary"
      >
        {stats}
      </M.Box>
    </M.Paper>
  )
}

function RevisionSkel() {
  const xs = Column.useDown('xs')
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
    [Column.up('sm')]: {
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
  metadata: {
    padding: t.spacing(1.75, 2, 1.75, 1.5),
  },
}))

interface RevisionProps extends RevisionFields {
  bucket: string
  name: string
  selected?: boolean
  // absent when the user may not delete revisions
  onSelect?: (hash: string) => void
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
  selected,
  onSelect,
}: RevisionProps) {
  const classes = useRevisionStyles()
  const { urls } = NamedRoutes.use()
  const xs = Column.useDown('xs')
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
          <JsonDisplay
            name="User metadata"
            value={userMeta}
            className={classes.metadata}
          />
        )
      }
      hash={
        <>
          {!!onSelect && (
            <M.Checkbox
              checked={!!selected}
              onChange={() => onSelect(hash)}
              edge="start"
              inputProps={{
                'aria-label': `Select revision ${packageHandleUtils.shortenRevision(hash)}`,
              }}
            />
          )}
          <M.Box className={classes.hash} component="span" order={xs ? 1 : 0}>
            <RRDom.Link
              to={urls.bucketPackageCompare(bucket, name, hash)}
              title="Compare revision"
            >
              {hash}
            </RRDom.Link>
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

const usePackageRevisionsStyles = M.makeStyles((t) => ({
  danger: {
    color: t.palette.error.dark,
    marginRight: t.spacing(1),
  },
}))

interface PackageRevisionsProps {
  bucket: string
  name: string
  page?: number
}

export function PackageRevisions({ bucket, name, page }: PackageRevisionsProps) {
  const classes = usePackageRevisionsStyles()
  const { prefs } = BucketPreferences.use()
  const { urls } = NamedRoutes.use()

  const actualPage = page || 1

  const makePageUrl = React.useCallback(
    (newP: number) =>
      urls.bucketPackageRevisions(bucket, name, { p: newP !== 1 ? newP : undefined }),
    [urls, bucket, name],
  )

  const scrollRef = React.useRef<HTMLSpanElement>(null)

  // Needed outside the toolbar's own match, to gate the per-row checkboxes.
  const canDelete = BucketPreferences.Result.match(
    { Ok: ({ ui: { actions } }) => actions.deleteRevision, _: () => false },
    prefs,
  )

  const bulk = useBulkDelete(bucket, name)

  usePrevious(actualPage, (prev) => {
    if (prev && actualPage !== prev) {
      scrollRef.current?.scrollIntoView()
      bulk.setSelected(new Set())
    }
  })

  const revisionCountQuery = GQL.useQuery(REVISION_COUNT_QUERY, { bucket, name })
  const revisionListQuery = GQL.useQuery(REVISION_LIST_QUERY, {
    bucket,
    name,
    page: actualPage,
    perPage: PER_PAGE,
  })

  const pageHashes = React.useMemo(
    () => (revisionListQuery.data?.package?.revisions.page || []).map((r) => r.hash),
    [revisionListQuery.data],
  )
  const allSelected =
    pageHashes.length > 0 && pageHashes.every((h) => bulk.selected.has(h))
  const toggleAll = () => bulk.setSelected(new Set(allSelected ? [] : pageHashes))

  const src = React.useMemo(() => ({ bucket, name }), [bucket, name])
  const dst = React.useMemo(() => ({ bucket }), [bucket])
  const updateDialog = PD.useCreateDialog({ dst, src })

  return (
    <M.Box pb={{ xs: 0, sm: 5 }} mx={{ xs: -2, sm: 0 }}>
      <RevisionDeleteDialog
        error={bulk.state.error}
        loading={bulk.state.loading}
        name={name}
        onClose={bulk.close}
        onDelete={bulk.run}
        open={bulk.state.opened}
        scope={{ type: 'revisions', count: bulk.selected.size }}
      />

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
        {BucketPreferences.Result.match(
          {
            Ok: ({ ui: { actions } }) => (
              <>
                {canDelete && (
                  <>
                    <M.FormControlLabel
                      control={
                        <M.Checkbox
                          checked={allSelected}
                          disabled={!pageHashes.length}
                          onChange={toggleAll}
                        />
                      }
                      label="Select all"
                      style={{ marginTop: -3, marginBottom: -3 }}
                    />
                    <M.Button
                      variant="outlined"
                      className={classes.danger}
                      disabled={!bulk.selected.size}
                      style={{ marginTop: -3, marginBottom: -3 }}
                      onClick={bulk.confirm}
                    >
                      Delete {bulk.selected.size || ''} selected
                    </M.Button>
                  </>
                )}
                {actions.revisePackage && (
                  <M.Button
                    variant="contained"
                    color="primary"
                    style={{ marginTop: -3, marginBottom: -3 }}
                    onClick={() => updateDialog.open()}
                  >
                    Revise package
                  </M.Button>
                )}
              </>
            ),
            Pending: () => <Buttons.Skeleton />,
            Init: () => null,
          },
          prefs,
        )}
      </M.Box>

      {GQL.fold(revisionCountQuery, {
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

          // Deleting a whole page shrinks the count past the page in the URL,
          // which would otherwise render empty with no pagination to escape it.
          if (actualPage > pages) return <RRDom.Redirect to={makePageUrl(pages)} />

          return (
            <>
              {GQL.fold(revisionListQuery, {
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
                      selected={bulk.selected.has(r.hash)}
                      onSelect={canDelete ? bulk.toggle : undefined}
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

export default function PackageRevisionsWrapper() {
  const { bucket, name } = RRDom.useParams<{ bucket: string; name: string }>()
  const location = RRDom.useLocation()
  invariant(!!bucket, '`bucket` must be defined')
  invariant(!!name, '`name` must be defined')

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
