import cx from 'classnames'
import * as dateFns from 'date-fns'
import * as Eff from 'effect'
import * as React from 'react'
import * as M from '@material-ui/core'
import { fade } from '@material-ui/core/styles'
import useComponentSize from '@rehooks/component-size'

import StackedAreaChart from 'components/StackedAreaChart'
import cfg from 'constants/config'
import * as GQL from 'utils/GraphQL'
import * as SVG from 'utils/SVG'
import { readableQuantity } from 'utils/string'

import { ColorPool } from './ColorPool'

import BUCKET_ACCESS_COUNTS_QUERY from './gql/BucketAccessCounts.generated'

type GQLBucketAccessCounts = NonNullable<
  GQL.DataForDoc<typeof BUCKET_ACCESS_COUNTS_QUERY>['bucketAccessCounts']
>
type GQLAccessCountsGroup = GQLBucketAccessCounts['byExt'][0]
type GQLAccessCounts = GQLBucketAccessCounts['combined']
type GQLAccessCountForDate = GQLAccessCounts['counts'][0]

interface ProcessedAccessCountForDate {
  date: Date
  value: number
  sum: number
}

interface ProcessedAccessCounts {
  total: number
  counts: readonly ProcessedAccessCountForDate[]
}

interface ProcessedAccessCountsGroup {
  ext: string
  counts: ProcessedAccessCounts
}

interface ProcessedBucketAccessCounts {
  byExt: readonly ProcessedAccessCountsGroup[]
  byExtCollapsed: readonly ProcessedAccessCountsGroup[]
  combined: ProcessedAccessCounts
}

const processAccessCountForDateArr = (
  counts: readonly GQLAccessCountForDate[],
): readonly ProcessedAccessCountForDate[] =>
  // compute running sum
  Eff.Array.mapAccum(counts, 0, (acc, { value, date }) => [
    acc + value,
    {
      value,
      date,
      sum: acc + value,
    },
  ])[1]

const processAccessCounts = (counts: GQLAccessCounts): ProcessedAccessCounts => ({
  total: counts.total,
  counts: processAccessCountForDateArr(counts.counts),
})

const processAccessCountsGroup = (
  group: GQLAccessCountsGroup,
): ProcessedAccessCountsGroup => ({
  ext: group.ext && `.${group.ext}`,
  counts: processAccessCounts(group.counts),
})

const processBucketAccessCounts = (
  counts: GQLBucketAccessCounts,
): ProcessedBucketAccessCounts => ({
  byExt: Eff.Array.map(counts.byExt, processAccessCountsGroup),
  byExtCollapsed: Eff.Array.map(counts.byExtCollapsed, processAccessCountsGroup),
  combined: processAccessCounts(counts.combined),
})

interface Cursor {
  i: number | null // ext
  j: number // date
}

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
    counts: ProcessedAccessCounts
  } | null
  firstHalf: boolean
}

function getCursorStats(
  counts: ProcessedBucketAccessCounts,
  cursor: Cursor | null,
): CursorStats | null {
  if (!cursor) return null

  const { date, ...combined } = counts.combined.counts[cursor.j]
  const byExt = counts.byExtCollapsed.map((e) => ({
    ext: e.ext,
    ...e.counts.counts[cursor.j],
  }))
  const highlighted = cursor.i == null ? null : counts.byExtCollapsed[cursor.i]
  const firstHalf = cursor.j < counts.combined.counts.length / 2
  return { date, combined, byExt, highlighted, firstHalf }
}

const skelData = Eff.Array.makeBy(
  8,
  Eff.flow(
    () => Eff.Array.makeBy(30, Math.random),
    Eff.Array.scan(0, Eff.Number.sum),
    Eff.Array.drop(1),
    Eff.Array.map((v) => Math.log(100 * v + 1)),
  ),
)

const skelColors = [
  [M.colors.grey[300], M.colors.grey[100]],
  [M.colors.grey[400], M.colors.grey[200]],
] as const

const mkPulsingGradient = ([c1, c2]: readonly [string, string], animate: boolean) =>
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
    () => Eff.Array.makeBy(lines, (i) => skelData[i % skelData.length]),
    [lines],
  )
  const fills = React.useMemo(
    () =>
      Eff.Array.makeBy(lines, (i) =>
        mkPulsingGradient(skelColors[i % skelColors.length], animate),
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
  data: Eff.Option.Option<ProcessedBucketAccessCounts>
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
    () =>
      Eff.Option.match(data, {
        onNone: () => null,
        onSome: (d) => `data:application/json,${JSON.stringify(d)}`,
      }),
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

interface StatsTipProps {
  stats: CursorStats | null
  colorPool: ColorPool
  className?: string
}

function StatsTip({ stats, colorPool, className, ...props }: StatsTipProps) {
  const classes = useStatsTipStyles()
  if (!stats) return null
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
  children: JSX.Element
  in: boolean
}

function Transition({ children, ...props }: TransitionProps) {
  const contentsRef = React.useRef<JSX.Element | null>(null)
  // when `in` is false, we want to keep the last rendered contents
  if (props.in) contentsRef.current = children
  return contentsRef.current && <M.Grow {...props}>{contentsRef.current}</M.Grow>
}

const useStyles = M.makeStyles((t) => ({
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
  chartHeight: number
}

export default function Downloads({
  bucket,
  colorPool,
  chartHeight,
  ...props
}: DownloadsProps) {
  const classes = useStyles()
  const ref = React.useRef(null)
  const { width } = useComponentSize(ref)
  const [window, setWindow] = React.useState(ANALYTICS_WINDOW_OPTIONS[0].value)

  const [cursor, setCursor] = React.useState<Cursor | null>(null)

  const result = GQL.useQuery(
    BUCKET_ACCESS_COUNTS_QUERY,
    { bucket, window },
    { pause: !cfg.analyticsBucket },
  )

  const processed = React.useMemo(
    () =>
      Eff.pipe(
        result,
        GQL.getDataOption,
        Eff.Option.flatMap((d) => Eff.Option.fromNullable(d.bucketAccessCounts)),
        Eff.Option.map(processBucketAccessCounts),
      ),
    [result],
  )

  const processedWithCursor = React.useMemo(
    () =>
      Eff.pipe(
        processed,
        Eff.Option.map((counts) => ({
          counts,
          cursorStats: getCursorStats(counts, cursor),
        })),
      ),
    [processed, cursor],
  )

  if (!cfg.analyticsBucket) {
    return (
      <ChartSkel height={chartHeight} width={width}>
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
          data={processed}
        />
      </div>
      <div className={classes.heading}>
        {Eff.Option.match(processedWithCursor, {
          onSome: ({ counts, cursorStats: stats }) => {
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
        {Eff.Option.match(processedWithCursor, {
          onSome: ({ counts, cursorStats: stats }) => {
            if (!counts.byExtCollapsed.length) {
              return (
                <ChartSkel height={chartHeight} width={width}>
                  <div className={classes.unavail}>No Data</div>
                </ChartSkel>
              )
            }

            return (
              <>
                {/* @ts-expect-error */}
                <StackedAreaChart
                  data={counts.byExtCollapsed.map((e) =>
                    e.counts.counts.map((i) => Math.log(i.sum + 1)),
                  )}
                  onCursor={setCursor}
                  height={chartHeight}
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
                  <StatsTip
                    stats={stats}
                    colorPool={colorPool}
                    className={cx(classes.dateStats, classes.right)}
                  />
                </Transition>
                <Transition in={!!stats && !stats.firstHalf}>
                  <StatsTip
                    stats={stats}
                    colorPool={colorPool}
                    className={cx(classes.dateStats, classes.left)}
                  />
                </Transition>
              </>
            )
          },
          onNone: () => <ChartSkel height={chartHeight} width={width} animate />,
        })}
      </div>
    </M.Box>
  )
}
