import type AWSSDK from 'aws-sdk'
import cx from 'classnames'
import * as dateFns from 'date-fns'
import * as Eff from 'effect'
import * as R from 'ramda'
import * as React from 'react'
import { Link as RRLink } from 'react-router-dom'
import * as redux from 'react-redux'
import * as M from '@material-ui/core'
import { fade } from '@material-ui/core/styles'
import useComponentSize from '@rehooks/component-size'

import Skeleton from 'components/Skeleton'
import StackedAreaChart from 'components/StackedAreaChart'
import cfg from 'constants/config'
import * as authSelectors from 'containers/Auth/selectors'
import * as APIConnector from 'utils/APIConnector'
import AsyncResult from 'utils/AsyncResult'
import { useData } from 'utils/Data'
import * as GQL from 'utils/GraphQL'
import * as NamedRoutes from 'utils/NamedRoutes'
import * as SVG from 'utils/SVG'
import { readableBytes, readableQuantity, formatQuantity } from 'utils/string'
import useConst from 'utils/useConstant'

import * as requests from '../requests'

import { ColorPool, makeColorPool } from './ColorPool'

import BUCKET_ACCESS_COUNTS_QUERY from './gql/BucketAccessCounts.generated'

import bg from './Overview-bg.jpg'

// interface StatsData {
//   exts: ExtData[]
//   totalObjects: number
//   totalBytes: number
// }

interface ExtData {
  ext: string
  bytes: number
  objects: number
}

const RODA_LINK = 'https://registry.opendata.aws'
const RODA_BUCKET = 'quilt-open-data-bucket'
const MAX_EXTS = 7
// must have length >= MAX_EXTS
const COLOR_MAP = [
  '#8ad3cb',
  '#d7ce69',
  '#bfbadb',
  '#f4806c',
  '#83b0d1',
  '#b2de67',
  '#bc81be',
  '#f0b5d3',
  '#7ba39f',
  '#9894ad',
  '#be7265',
  '#94ad6b',
]

const useObjectsByExtStyles = M.makeStyles((t) => ({
  root: {
    display: 'grid',
    gridAutoRows: 20,
    gridColumnGap: t.spacing(1),
    gridRowGap: t.spacing(0.25),
    gridTemplateAreas: `
      ". heading heading"
    `,
    gridTemplateColumns: 'minmax(30px, max-content) 1fr minmax(30px, max-content)',
    gridTemplateRows: 'auto',
    [t.breakpoints.down('sm')]: {
      gridTemplateAreas: `
        "heading heading heading"
      `,
    },
  },
  heading: {
    ...t.typography.h6,
    gridArea: 'heading',
    marginBottom: t.spacing(1),
    [t.breakpoints.down('sm')]: {
      textAlign: 'center',
    },
  },
  ext: {
    color: t.palette.text.secondary,
    gridColumn: 1,
    fontSize: t.typography.overline.fontSize,
    fontWeight: t.typography.fontWeightMedium,
    letterSpacing: t.typography.subtitle2.letterSpacing,
    lineHeight: t.typography.pxToRem(20),
    textAlign: 'right',
  },
  count: {
    color: t.palette.text.secondary,
    gridColumn: 3,
    fontSize: t.typography.overline.fontSize,
    fontWeight: t.typography.fontWeightMedium,
    letterSpacing: t.typography.subtitle2.letterSpacing,
    lineHeight: t.typography.pxToRem(20),
  },
  bar: {
    background: t.palette.action.hover,
    gridColumn: 2,
  },
  gauge: {
    height: '100%',
    position: 'relative',
  },
  flip: {},
  size: {
    color: t.palette.common.white,
    fontSize: t.typography.overline.fontSize,
    fontWeight: t.typography.fontWeightMedium,
    letterSpacing: t.typography.subtitle2.letterSpacing,
    lineHeight: t.typography.pxToRem(20),
    position: 'absolute',
    right: t.spacing(1),
    '&$flip': {
      color: t.palette.text.hint,
      left: `calc(100% + ${t.spacing(1)}px)`,
      right: 'auto',
    },
  },
  skeleton: {
    gridColumn: '1 / span 3',
  },
  unavail: {
    ...t.typography.body2,
    alignItems: 'center',
    display: 'flex',
    gridColumn: '1 / span 3',
    gridRow: `2 / span ${MAX_EXTS}`,
    justifyContent: 'center',
  },
}))

interface ObjectsByExtProps extends M.BoxProps {
  data: $TSFixMe // AsyncResult<ExtData[]>
  colorPool: ColorPool
}

function ObjectsByExt({ data, colorPool, ...props }: ObjectsByExtProps) {
  const classes = useObjectsByExtStyles()
  return (
    <M.Box className={classes.root} {...props}>
      <div className={classes.heading}>Objects by File Extension</div>
      {AsyncResult.case(
        {
          Ok: (exts: ExtData[]) => {
            const capped = exts.slice(0, MAX_EXTS)
            const maxBytes = capped.reduce((max, e) => Math.max(max, e.bytes), 0)
            const max = Math.log(maxBytes + 1)
            const scale = (x: number) => Math.log(x + 1) / max
            return capped.map(({ ext, bytes, objects }, i) => {
              const color = colorPool.get(ext)
              return (
                <React.Fragment key={`ext:${ext}`}>
                  <div className={classes.ext} style={{ gridRow: i + 2 }}>
                    {ext || 'other'}
                  </div>
                  <div className={classes.bar} style={{ gridRow: i + 2 }}>
                    <div
                      className={classes.gauge}
                      style={{
                        background: color,
                        width: `${scale(bytes) * 100}%`,
                      }}
                    >
                      <div
                        className={cx(classes.size, {
                          [classes.flip]: scale(bytes) < 0.3,
                        })}
                      >
                        {readableBytes(bytes)}
                      </div>
                    </div>
                  </div>
                  <div className={classes.count} style={{ gridRow: i + 2 }}>
                    {readableQuantity(objects)}
                  </div>
                </React.Fragment>
              )
            })
          },
          _: (r: $TSFixMe) => (
            <>
              {R.times(
                (i) => (
                  <Skeleton
                    key={`skeleton:${i}`}
                    className={classes.skeleton}
                    style={{ gridRow: i + 2 }}
                    animate={!AsyncResult.Err.is(r)}
                  />
                ),
                MAX_EXTS,
              )}
              {AsyncResult.Err.is(r) && (
                <div className={classes.unavail}>Data unavailable</div>
              )}
            </>
          ),
        },
        data,
      )}
    </M.Box>
  )
}

const skelData = R.times(
  R.pipe(
    () => R.times(Math.random, 30),
    R.scan(R.add, 0),
    R.drop(1),
    R.map((v) => Math.log(100 * v + 1)),
  ),
  8,
)

const skelColors = [
  [M.colors.grey[300], M.colors.grey[100]],
  [M.colors.grey[400], M.colors.grey[200]],
] as const

const mkPulsingGradient = ({
  colors: [c1, c2],
  animate = false,
}: {
  colors: readonly [string, string]
  animate?: boolean
}) =>
  SVG.Paint.Server(
    <linearGradient>
      <stop offset="0%" stopColor={c2}>
        {animate && (
          <animate
            attributeName="stop-color"
            values={`${c1}; ${c2}; ${c1}`}
            dur="3s"
            repeatCount="indefinite"
          />
        )}
      </stop>
    </linearGradient>,
  )

interface ChartSkelProps {
  height: number
  width: number
  lines?: number
  animate?: boolean
  children?: React.ReactNode
}

function ChartSkel({
  height,
  width,
  lines = skelData.length,
  animate = false,
  children,
}: ChartSkelProps) {
  const data = React.useMemo(
    () => R.times((i) => skelData[i % skelData.length], lines),
    [lines],
  )
  const fills = React.useMemo(
    () =>
      R.times(
        (i) => mkPulsingGradient({ colors: skelColors[i % skelColors.length], animate }),
        lines,
      ),
    [lines, animate],
  )
  return (
    <M.Box position="relative">
      {/* @ts-expect-error */}
      <StackedAreaChart
        data={data}
        width={width}
        height={height}
        extendL
        extendR
        px={10}
        areaFills={fills}
        lineStroke={SVG.Paint.Color(M.colors.grey[500])}
      />
      {children}
    </M.Box>
  )
}

const ANALYTICS_WINDOW_OPTIONS = [
  { value: 31, label: 'Last 1 month' },
  { value: 91, label: 'Last 3 months' },
  { value: 182, label: 'Last 6 months' },
  { value: 365, label: 'Last 12 months' },
]

interface DownloadsRangeProps {
  value: number
  onChange: (value: number) => void
  bucket: string
  data: BucketAccessCountsGQL | null
}

function DownloadsRange({ value, onChange, bucket, data }: DownloadsRangeProps) {
  const [anchor, setAnchor] = React.useState(null)

  const open = React.useCallback(
    (e) => {
      setAnchor(e.target)
    },
    [setAnchor],
  )

  const close = React.useCallback(() => {
    setAnchor(null)
  }, [setAnchor])

  const choose = React.useCallback(
    (e) => {
      onChange(e.target.value)
      close()
    },
    [onChange, close],
  )

  const { label } = ANALYTICS_WINDOW_OPTIONS.find((o) => o.value === value) || {}

  const jsonData = React.useMemo(
    // TODO: remove `__typename`s
    () => data && `data:application/json,${JSON.stringify(data)}`,
    [data],
  )

  return (
    <>
      <M.Button variant="outlined" size="small" onClick={open}>
        <M.Box component="span" width={5} />
        {label} <M.Icon>expand_more</M.Icon>
      </M.Button>
      <M.Menu anchorEl={anchor} open={!!anchor} onClose={close}>
        {ANALYTICS_WINDOW_OPTIONS.map((o) => (
          <M.MenuItem
            key={o.value}
            selected={o.value === value}
            value={o.value}
            onClick={choose}
          >
            {o.label}
          </M.MenuItem>
        ))}
        <M.Divider />
        <M.MenuItem
          onClick={close}
          component="a"
          href={jsonData || 'javascript:void(0)'}
          download={`${bucket}.downloads.json`}
          disabled={!jsonData}
        >
          Download to file
        </M.MenuItem>
      </M.Menu>
    </>
  )
}

const useStatsTipStyles = M.makeStyles((t) => ({
  root: {
    background: fade(t.palette.grey[700], 0.9),
    color: t.palette.common.white,
    padding: '6px 8px',
  },
  head: {
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  date: {},
  total: {},
  extsContainer: {
    alignItems: 'center',
    display: 'grid',
    gridAutoRows: 'auto',
    gridColumnGap: 4,
    gridTemplateColumns: 'max-content max-content 1fr',
  },
  ext: {
    fontSize: 12,
    lineHeight: '16px',
    maxWidth: 70,
    opacity: 0.6,
    overflow: 'hidden',
    textAlign: 'right',
    textOverflow: 'ellipsis',
  },
  color: {
    borderRadius: '50%',
    height: 8,
    opacity: 0.6,
    width: 8,
  },
  number: {
    fontSize: 12,
    lineHeight: '16px',
    opacity: 0.6,
  },
  hl: {
    opacity: 1,
  },
}))

interface CursorStats {
  date: Date
  combined: {
    sum: number
    value: number
  }
  byExt: {
    ext: string
    sum: number
    value: number
    date: Date
  }[]
  highlighted: {
    ext: string
    counts: AccessCountsWithSum
  } | null
  firstHalf: boolean
}

interface StatsTipProps {
  stats: CursorStats
  colorPool: ColorPool
  className?: string
}

function assertNonNull<T extends unknown>(x: T): NonNullable<T> {
  if (x == null) throw new Error('Unexpected null')
  return x as NonNullable<T>
}

function StatsTip({ stats, colorPool, className, ...props }: StatsTipProps) {
  const classes = useStatsTipStyles()
  return (
    <M.Paper className={cx(classes.root, className)} elevation={8} {...props}>
      <div className={classes.head}>
        <div className={classes.date}>{dateFns.format(stats.date, 'd MMM')}</div>
        <div className={classes.total}>
          {readableQuantity(stats.combined.sum)} (+
          {readableQuantity(stats.combined.value)})
        </div>
      </div>
      <div className={classes.extsContainer}>
        {stats.byExt.map((s) => {
          const hl = stats.highlighted ? stats.highlighted.ext === s.ext : true
          return (
            <React.Fragment key={s.ext}>
              <div className={cx(classes.ext, hl && classes.hl)}>{s.ext || 'other'}</div>
              <div
                className={cx(classes.color, hl && classes.hl)}
                style={{ background: colorPool.get(s.ext) }}
              />
              <div className={cx(classes.number, hl && classes.hl)}>
                {readableQuantity(s.sum)} (+
                {readableQuantity(s.value)})
              </div>
            </React.Fragment>
          )
        })}
      </div>
    </M.Paper>
  )
}

interface TransitionProps {
  children: () => JSX.Element
  in?: boolean
}

const Transition = ({ children, ...props }: TransitionProps) => {
  const contentsRef = React.useRef<JSX.Element | null>(null)
  if (props.in) contentsRef.current = children()
  return contentsRef.current && <M.Grow {...props}>{contentsRef.current}</M.Grow>
}

// use the same height as the bar chart: 20px per bar with 2px margin
const CHART_H = 22 * MAX_EXTS - 2

const useDownloadsStyles = M.makeStyles((t) => ({
  root: {
    display: 'grid',
    gridRowGap: t.spacing(0.25),
    gridTemplateAreas: `
      "heading period"
      "chart chart"
    `,
    gridTemplateColumns: 'min-content 1fr',
    gridTemplateRows: 'auto auto',
    [t.breakpoints.down('sm')]: {
      gridTemplateAreas: `
        "heading"
        "chart"
        "period"
      `,
      gridTemplateColumns: '1fr',
      gridTemplateRows: 'auto auto auto',
    },
  },
  heading: {
    ...t.typography.h6,
    gridArea: 'heading',
    marginBottom: t.spacing(1),
    whiteSpace: 'nowrap',
    [t.breakpoints.down('sm')]: {
      marginBottom: 0,
      textAlign: 'center',
    },
  },
  ext: {
    display: 'inline-block',
    maxWidth: 100,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    verticalAlign: 'bottom',
  },
  period: {
    display: 'flex',
    gridArea: 'period',
    justifyContent: 'center',
    alignItems: 'center',
    [t.breakpoints.down('sm')]: {
      paddingBottom: t.spacing(1),
      paddingTop: t.spacing(2),
    },
    [t.breakpoints.up('md')]: {
      height: 37,
      justifyContent: 'flex-end',
    },
  },
  chart: {
    gridArea: 'chart',
    position: 'relative',
  },
  left: {},
  right: {},
  dateStats: {
    maxWidth: 180,
    position: 'absolute',
    top: 0,
    width: 'calc(50% - 8px)',
    zIndex: 1,
    '&$left': {
      left: 0,
    },
    '&$right': {
      right: 0,
    },
  },
  unavail: {
    ...t.typography.body2,
    alignItems: 'center',
    display: 'flex',
    height: '100%',
    justifyContent: 'center',
    position: 'absolute',
    top: 0,
    width: '100%',
  },
}))

interface DownloadsProps extends M.BoxProps {
  bucket: string
  colorPool: ColorPool
}

type BucketAccessCountsGQL = NonNullable<
  GQL.DataForDoc<typeof BUCKET_ACCESS_COUNTS_QUERY>['bucketAccessCounts']
>

type AccessCountsGQL = BucketAccessCountsGQL['combined']
type AccessCountForDate = Omit<AccessCountsGQL['counts'][0], '__typename'>

interface AccessCountForDateWithSum extends Omit<AccessCountForDate, '__typename'> {
  sum: number
}

interface AccessCountsWithSum {
  total: number
  counts: readonly AccessCountForDateWithSum[]
}

// interface Counts {
//   total: number
//   counts: readonly AccessCountForDate[]
// }

// interface CountsWithSum extends Counts {
//   counts: readonly AccessCountForDateWithSum[]
// }

// interface BucketAccessCounts {
//   byExt: readonly {
//     ext: string
//     counts: Counts
//   }[]
//   byExtCollapsed: readonly {
//     ext: string
//     counts: Counts
//   }[]
//   combined: Counts
// }

// interface BucketAccessCountsWithSum {
//   byExt: readonly {
//     ext: string
//     counts: CountsWithSum
//   }[]
//   byExtCollapsed: readonly {
//     ext: string
//     counts: CountsWithSum
//   }[]
//   combined: CountsWithSum
// }

const computeSum = (
  counts: readonly AccessCountForDate[],
): readonly AccessCountForDateWithSum[] =>
  Eff.Array.mapAccum(counts, 0, (acc, { value, date }) => [
    acc + value,
    // const sum = acc.total + value
    {
      value,
      date,
      sum: acc + value,
    },
  ])[1]

interface Cursor {
  // XXX: rename to row/col? date/band?
  i: number | null
  j: number
}

function Downloads({ bucket, colorPool, ...props }: DownloadsProps) {
  const classes = useDownloadsStyles()
  const ref = React.useRef(null)
  const { width } = useComponentSize(ref)
  const [window, setWindow] = React.useState(ANALYTICS_WINDOW_OPTIONS[0].value)

  const [cursor, setCursor] = React.useState<Cursor | null>(null)

  const countsGql = GQL.useQuery(
    BUCKET_ACCESS_COUNTS_QUERY,
    { bucket, window },
    { pause: !cfg.analyticsBucket },
  )

  const dataGql = GQL.fold(countsGql, {
    data: (d) => d.bucketAccessCounts,
    fetching: () => null,
    error: () => null,
  })

  const dataO = React.useMemo(
    () =>
      Eff.pipe(
        countsGql,
        GQL.getDataOption,
        Eff.Option.flatMap((d) => Eff.Option.fromNullable(d.bucketAccessCounts)),
        // TODO: clean typename
        Eff.Option.map(({ byExt, byExtCollapsed, combined }) => ({
          byExt: Eff.Array.map(byExt, (e) =>
            Eff.Struct.evolve(e, {
              counts: (c) => Eff.Struct.evolve(c, { counts: computeSum }),
            }),
          ),
          byExtCollapsed: Eff.Array.map(byExtCollapsed, (e) =>
            Eff.Struct.evolve(e, {
              counts: (c) => Eff.Struct.evolve(c, { counts: computeSum }),
            }),
          ),
          combined: Eff.Struct.evolve(combined, { counts: computeSum }),
        })),
      ),
    [countsGql],
  )

  const computed = React.useMemo(
    () =>
      Eff.pipe(
        dataO,
        Eff.Option.map((counts) => {
          let cursorStats: CursorStats | null = null
          if (cursor) {
            const { date, ...combined } = counts.combined.counts[cursor.j]
            const byExt = counts.byExtCollapsed.map((e) => ({
              ext: e.ext,
              ...e.counts.counts[cursor.j],
            }))
            const highlighted = cursor.i == null ? null : counts.byExtCollapsed[cursor.i]
            const firstHalf = cursor.j < counts.combined.counts.length / 2
            cursorStats = { date, combined, byExt, highlighted, firstHalf }
          }
          return { counts, cursorStats }
        }),
      ),
    [dataO, cursor],
  )

  if (!cfg.analyticsBucket) {
    return (
      <ChartSkel height={CHART_H} width={width}>
        <div className={classes.unavail}>Requires CloudTrail</div>
      </ChartSkel>
    )
  }

  return (
    <M.Box className={classes.root} {...props} ref={ref}>
      <div className={classes.period}>
        <DownloadsRange
          value={window}
          onChange={setWindow}
          bucket={bucket}
          data={dataGql}
        />
      </div>
      <div className={classes.heading}>
        {Eff.Option.match(computed, {
          onSome: ({ counts, cursorStats: stats }) => {
            // TODO: use flatmap or smth
            if (!counts?.byExtCollapsed.length) return 'Downloads'

            const hl = stats?.highlighted
            const ext = hl ? hl.ext || 'other' : 'total'
            const total = hl ? hl.counts.total : counts.combined.total
            return (
              <>
                Downloads (<span className={classes.ext}>{ext}</span>):{' '}
                {readableQuantity(total)}
              </>
            )
          },
          onNone: () => 'Downloads',
        })}
      </div>
      <div className={classes.chart}>
        {Eff.Option.match(computed, {
          onSome: ({ counts, cursorStats: stats }) => {
            if (!counts.byExtCollapsed.length) {
              return (
                <ChartSkel height={CHART_H} width={width}>
                  <div className={classes.unavail}>No Data</div>
                </ChartSkel>
              )
            }

            return (
              <>
                {/* @ts-expect-error */}
                <StackedAreaChart
                  data={counts.byExtCollapsed.map((e) =>
                    // FIXME
                    e.counts.counts.map((i) => Math.log(i.sum + 1)),
                  )}
                  onCursor={setCursor}
                  height={CHART_H}
                  width={width}
                  areaFills={counts.byExtCollapsed.map((e) =>
                    SVG.Paint.Color(colorPool.get(e.ext)),
                  )}
                  lineStroke={SVG.Paint.Color(M.colors.grey[500])}
                  extendL
                  extendR
                  px={10}
                />
                <Transition in={!!stats && stats.firstHalf}>
                  {() => (
                    <StatsTip
                      stats={assertNonNull(stats)}
                      colorPool={colorPool}
                      className={cx(classes.dateStats, classes.right)}
                    />
                  )}
                </Transition>
                <Transition in={!!stats && !stats.firstHalf}>
                  {() => (
                    <StatsTip
                      stats={assertNonNull(stats)}
                      colorPool={colorPool}
                      className={cx(classes.dateStats, classes.left)}
                    />
                  )}
                </Transition>
              </>
            )
          },
          onNone: () => <ChartSkel height={22 * MAX_EXTS - 2} width={width} animate />,
        })}
      </div>
    </M.Box>
  )
}

const useStatDisplayStyles = M.makeStyles((t) => ({
  root: {
    alignItems: 'baseline',
    display: 'flex',
    '& + &': {
      marginLeft: t.spacing(1.5),
      [t.breakpoints.up('sm')]: {
        marginLeft: t.spacing(4),
      },
      [t.breakpoints.up('md')]: {
        marginLeft: t.spacing(6),
      },
    },
  },
  value: {
    fontSize: t.typography.h6.fontSize,
    fontWeight: t.typography.fontWeightBold,
    letterSpacing: 0,
    lineHeight: '20px',
    [t.breakpoints.up('sm')]: {
      fontSize: t.typography.h4.fontSize,
      lineHeight: '32px',
    },
  },
  label: {
    ...t.typography.body2,
    color: t.palette.grey[300],
    lineHeight: 1,
    marginLeft: t.spacing(0.5),
    [t.breakpoints.up('sm')]: {
      marginLeft: t.spacing(1),
    },
  },
  skeletonContainer: {
    alignItems: 'center',
    height: 20,
    [t.breakpoints.up('sm')]: {
      height: 32,
    },
  },
  skeleton: {
    borderRadius: t.shape.borderRadius,
    height: t.typography.h6.fontSize,
    width: 96,
    [t.breakpoints.up('sm')]: {
      height: t.typography.h4.fontSize,
      width: 120,
    },
  },
}))

interface StatDisplayProps {
  value: $TSFixMe // AsyncResult<?>
  label?: string
  format?: (v: any) => any
  fallback?: (v: any) => any
}

function StatDisplay({ value, label, format, fallback }: StatDisplayProps) {
  const classes = useStatDisplayStyles()
  return R.pipe(
    AsyncResult.case({
      Ok: R.pipe(format || R.identity, AsyncResult.Ok),
      Err: R.pipe(fallback || R.identity, AsyncResult.Ok),
      _: R.identity,
    }),
    AsyncResult.case({
      Ok: (v: $TSFixMe) =>
        v != null && (
          <span className={classes.root}>
            <span className={classes.value}>{v}</span>
            {!!label && <span className={classes.label}>{label}</span>}
          </span>
        ),
      _: () => (
        <div className={cx(classes.root, classes.skeletonContainer)}>
          <Skeleton className={classes.skeleton} bgcolor="grey.400" />
        </div>
      ),
    }),
    // @ts-expect-error
  )(value) as JSX.Element
}

const useStyles = M.makeStyles((t) => ({
  root: {
    position: 'relative',
    [t.breakpoints.down('xs')]: {
      borderRadius: 0,
    },
    [t.breakpoints.up('sm')]: {
      marginTop: t.spacing(2),
    },
  },
  top: {
    background: `center / cover url(${bg}) ${t.palette.grey[700]}`,
    borderTopLeftRadius: t.shape.borderRadius,
    borderTopRightRadius: t.shape.borderRadius,
    color: t.palette.common.white,
    overflow: 'hidden',
    paddingBottom: t.spacing(3),
    paddingLeft: t.spacing(2),
    paddingRight: t.spacing(2),
    paddingTop: t.spacing(4),
    position: 'relative',
    [t.breakpoints.up('sm')]: {
      padding: t.spacing(4),
    },
    [t.breakpoints.down('xs')]: {
      borderRadius: 0,
    },
  },
  settings: {
    color: t.palette.common.white,
    position: 'absolute',
    right: t.spacing(2),
    top: t.spacing(2),
  },
}))

interface HeaderProps {
  s3: AWSSDK.S3
  bucket: string
  overviewUrl: string | null | undefined
  description: string | null | undefined
}

export default function Header({ s3, overviewUrl, bucket, description }: HeaderProps) {
  const classes = useStyles()
  const req = APIConnector.use()
  const isRODA = !!overviewUrl && overviewUrl.includes(`/${RODA_BUCKET}/`)
  const colorPool = useConst(() => makeColorPool(COLOR_MAP))
  const statsData = useData(requests.bucketStats, { req, s3, bucket, overviewUrl })
  const pkgCountData = useData(requests.countPackageRevisions, { req, bucket })
  const { urls } = NamedRoutes.use()
  const isAdmin = redux.useSelector(authSelectors.isAdmin)
  return (
    <M.Paper className={classes.root}>
      <M.Box className={classes.top}>
        <M.Typography variant="h5">{bucket}</M.Typography>
        {!!description && (
          <M.Box mt={1}>
            <M.Typography variant="body1">{description}</M.Typography>
          </M.Box>
        )}
        {isRODA && (
          <M.Box
            mt={1}
            position={{ md: 'absolute' }}
            right={{ md: 32 }}
            bottom={{ md: 31 }}
            color="grey.300"
            textAlign={{ md: 'right' }}
          >
            <M.Typography variant="body2">
              From the{' '}
              <M.Link href={RODA_LINK} color="inherit" underline="always">
                Registry of Open Data on AWS
              </M.Link>
            </M.Typography>
          </M.Box>
        )}
        <M.Box mt={{ xs: 2, sm: 3 }} display="flex" alignItems="baseline">
          <StatDisplay
            value={AsyncResult.prop('totalBytes', statsData.result)}
            format={readableBytes}
            fallback={() => '? B'}
          />
          <StatDisplay
            value={AsyncResult.prop('totalObjects', statsData.result)}
            format={readableQuantity}
            label="Objects"
            fallback={() => '?'}
          />
          <StatDisplay
            value={pkgCountData.result}
            format={formatQuantity}
            label="Packages"
            fallback={() => null}
          />
        </M.Box>
        {isAdmin && (
          <RRLink className={classes.settings} to={urls.adminBucketEdit(bucket)}>
            <M.IconButton color="inherit">
              <M.Icon>settings</M.Icon>
            </M.IconButton>
          </RRLink>
        )}
      </M.Box>
      <M.Box
        p={{ xs: 2, sm: 4 }}
        display="flex"
        flexDirection={{ xs: 'column', md: 'row' }}
        alignItems={{ md: 'flex-start' }}
        position="relative"
      >
        <ObjectsByExt
          data={AsyncResult.prop('exts', statsData.result)}
          width="100%"
          flexShrink={1}
          colorPool={colorPool}
        />
        <M.Box
          display="flex"
          flexDirection="column"
          justifyContent="center"
          flexShrink={0}
          height={{ xs: 32, md: '100%' }}
          width={{ xs: '100%', md: 32 }}
        >
          <M.Hidden mdUp>
            <M.Divider />
          </M.Hidden>
        </M.Box>
        <Downloads bucket={bucket} colorPool={colorPool} width="100%" flexShrink={1} />
      </M.Box>
    </M.Paper>
  )
}
