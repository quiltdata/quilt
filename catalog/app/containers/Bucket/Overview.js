import cx from 'classnames'
import * as dateFns from 'date-fns'
import * as R from 'ramda'
import * as React from 'react'
import * as M from '@material-ui/core'
import { fade } from '@material-ui/core/styles'
import useComponentSize from '@rehooks/component-size'

import { copyWithoutSpaces } from 'components/BreadCrumbs'
import * as Pagination from 'components/Pagination'
import Placeholder from 'components/Placeholder'
import * as Preview from 'components/Preview'
import Skeleton from 'components/Skeleton'
import StackedAreaChart from 'components/StackedAreaChart'
import Thumbnail from 'components/Thumbnail'
import * as AWS from 'utils/AWS'
import AsyncResult from 'utils/AsyncResult'
import * as BucketConfig from 'utils/BucketConfig'
import * as Config from 'utils/Config'
import Data from 'utils/Data'
import * as LinkedData from 'utils/LinkedData'
import * as NamedRoutes from 'utils/NamedRoutes'
import * as SVG from 'utils/SVG'
import Link from 'utils/StyledLink'
import { getBreadCrumbs } from 'utils/s3paths'
import { readableBytes, readableQuantity } from 'utils/string'

import { displayError } from './errors'
import * as requests from './requests'

import bg from './Overview-bg.jpg'

const RODA_LINK = 'https://registry.opendata.aws'
const EXAMPLE_BUCKET = 'quilt-example'
const RODA_BUCKET = 'quilt-open-data-bucket'
const MAX_EXTS = 7
// must have length >= MAX_EXTS
const COLOR_MAP = [
  '#6996ff',
  M.colors.blue[300],
  M.colors.teal.A200,
  M.colors.lightGreen[300],
  M.colors.amber[300],
  M.colors.deepOrange[300],
  M.colors.pink[300],
  M.colors.purple[300],
  M.colors.indigo[300],
  M.colors.cyan[300],
  M.colors.green[300],
  M.colors.lime[300],
  M.colors.yellow[300],
  M.colors.brown[300],
]

function mkKeyedPool(pool) {
  const map = {}
  let poolIdx = 0
  const get = (key) => {
    if (!(key in map)) {
      // eslint-disable-next-line no-plusplus
      map[key] = pool[poolIdx++ % pool.length]
    }
    return map[key]
  }
  return { get }
}

function useConst(cons) {
  const ref = React.useRef(null)
  if (!ref.current) ref.current = { value: cons() }
  return ref.current.value
}

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

function ObjectsByExt({ data, colorPool, ...props }) {
  const classes = useObjectsByExtStyles()
  return (
    <M.Box className={classes.root} {...props}>
      <div className={classes.heading}>Objects by File Extension</div>
      {AsyncResult.case(
        {
          Ok: (exts) => {
            const capped = exts.slice(0, MAX_EXTS)
            const maxBytes = capped.reduce((max, e) => Math.max(max, e.bytes), 0)
            const max = Math.log(maxBytes + 1)
            const scale = (x) => Math.log(x + 1) / max
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
          _: (r) => (
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
]

const mkPulsingGradient = ({ colors: [c1, c2], animate = false }) =>
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

function ChartSkel({
  height,
  width,
  lines = skelData.length,
  animate = false,
  children,
}) {
  const data = React.useMemo(() => R.times((i) => skelData[i % skelData.length], lines), [
    lines,
  ])
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

function DownloadsRange({ value, onChange, bucket, rawData }) {
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
          href={rawData}
          download={`${bucket}.downloads.json`}
          disabled={!rawData}
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
    padding: [[6, 8]],
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
    maxWidth: 80,
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

function StatsTip({ stats, colorPool, className, ...props }) {
  const classes = useStatsTipStyles()
  return (
    <M.Paper className={cx(classes.root, className)} elevation={8} {...props}>
      <div className={classes.head}>
        <div className={classes.date}>{dateFns.format(stats.date, 'D MMM')}</div>
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

const Transition = ({ TransitionComponent = M.Grow, children, ...props }) => {
  const contentsRef = React.useRef(null)
  if (props.in) contentsRef.current = children()
  return (
    contentsRef.current && (
      <TransitionComponent {...props}>{contentsRef.current}</TransitionComponent>
    )
  )
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

function Downloads({ bucket, colorPool, ...props }) {
  const { analyticsBucket } = Config.useConfig()
  const s3req = AWS.S3.useRequest()
  const today = React.useMemo(() => new Date(), [])
  const classes = useDownloadsStyles()
  const ref = React.useRef(null)
  const { width } = useComponentSize(ref)
  const [window, setWindow] = React.useState(ANALYTICS_WINDOW_OPTIONS[0].value)
  const [cursor, setCursor] = React.useState(null)
  const cursorStats = (counts) => {
    if (!cursor) return null
    const { date, ...combined } = counts.combined.counts[cursor.j]
    const byExt = counts.byExt.map((e) => ({
      ext: e.ext,
      ...e.counts[cursor.j],
    }))
    const highlighted = cursor.i == null ? null : counts.byExt[cursor.i]
    const firstHalf = cursor.j < counts.combined.counts.length / 2
    return { date, combined, byExt, highlighted, firstHalf }
  }

  const mkRawData = AsyncResult.case({
    Ok: (data) => `data:application/json,${JSON.stringify(data)}`,
    _: () => null,
  })

  if (!analyticsBucket) {
    return (
      <ChartSkel height={CHART_H} width={width}>
        <div className={classes.unavail}>Requires CloudTrail</div>
      </ChartSkel>
    )
  }

  return (
    <Data
      fetch={requests.bucketAccessCounts}
      params={{ s3req, analyticsBucket, bucket, today, window }}
    >
      {(data) => (
        <M.Box className={classes.root} {...props} ref={ref}>
          <div className={classes.period}>
            <DownloadsRange
              value={window}
              onChange={setWindow}
              bucket={bucket}
              rawData={mkRawData(data)}
            />
          </div>
          <div className={classes.heading}>
            {AsyncResult.case(
              {
                Ok: (counts) => {
                  const stats = cursorStats(counts)
                  const hl = stats && stats.highlighted
                  const ext = hl ? hl.ext || 'other' : 'total'
                  const total = hl ? hl.total : counts.combined.total
                  if (!counts.byExt.length) return 'Downloads'
                  return (
                    <>
                      Downloads (<span className={classes.ext}>{ext}</span>):{' '}
                      {readableQuantity(total)}
                    </>
                  )
                },
                _: () => 'Downloads',
              },
              data,
            )}
          </div>
          <div className={classes.chart}>
            {AsyncResult.case(
              {
                Ok: (counts) => {
                  if (!counts.byExt.length) {
                    return (
                      <ChartSkel height={CHART_H} width={width}>
                        <div className={classes.unavail}>No Data</div>
                      </ChartSkel>
                    )
                  }

                  const stats = cursorStats(counts)
                  return (
                    <>
                      <StackedAreaChart
                        data={counts.byExt.map((e) =>
                          e.counts.map((i) => Math.log(i.sum + 1)),
                        )}
                        onCursor={setCursor}
                        height={CHART_H}
                        width={width}
                        areaFills={counts.byExt.map((e) =>
                          SVG.Paint.Color(colorPool.get(e.ext)),
                        )}
                        extendL
                        extendR
                        px={10}
                      />
                      <Transition in={!!stats && stats.firstHalf}>
                        {() => (
                          <StatsTip
                            stats={stats}
                            colorPool={colorPool}
                            className={cx(classes.dateStats, classes.right)}
                          />
                        )}
                      </Transition>
                      <Transition in={!!stats && !stats.firstHalf}>
                        {() => (
                          <StatsTip
                            stats={stats}
                            colorPool={colorPool}
                            className={cx(classes.dateStats, classes.left)}
                          />
                        )}
                      </Transition>
                    </>
                  )
                },
                _: () => <ChartSkel height={22 * MAX_EXTS - 2} width={width} animate />,
              },
              data,
            )}
          </div>
        </M.Box>
      )}
    </Data>
  )
}

const useStatDisplayStyles = M.makeStyles((t) => ({
  root: {
    alignItems: 'baseline',
    display: 'flex',
    '& + &': {
      marginLeft: t.spacing(1),
      [t.breakpoints.up('sm')]: {
        marginLeft: t.spacing(3),
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

function StatDisplay({ value, label, format, fallback }) {
  const classes = useStatDisplayStyles()
  return R.pipe(
    AsyncResult.case({
      Ok: R.pipe(format || R.identity, AsyncResult.Ok),
      Err: R.pipe(fallback || R.identity, AsyncResult.Ok),
      _: R.identity,
    }),
    AsyncResult.case({
      Ok: (v) => (
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
  )(value)
}

const useHeadStyles = M.makeStyles((t) => ({
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
}))

function Head({ es, s3req, overviewUrl, bucket, description }) {
  const classes = useHeadStyles()
  const isRODA = !!overviewUrl && overviewUrl.includes(`/${RODA_BUCKET}/`)
  const colorPool = useConst(() => mkKeyedPool(COLOR_MAP))
  return (
    <Data fetch={requests.bucketStats} params={{ es, s3req, bucket, overviewUrl }}>
      {(res) => (
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
                value={AsyncResult.prop('totalObjects', res)}
                format={readableQuantity}
                label="Objects"
                fallback={() => '?'}
              />
              <StatDisplay
                value={AsyncResult.prop('totalBytes', res)}
                format={readableBytes}
                fallback={() => '? B'}
              />
            </M.Box>
          </M.Box>
          <M.Box
            p={{ xs: 2, sm: 4 }}
            display="flex"
            flexDirection={{ xs: 'column', md: 'row' }}
            alignItems={{ md: 'flex-start' }}
            position="relative"
          >
            <ObjectsByExt
              data={AsyncResult.prop('exts', res)}
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
            <Downloads
              bucket={bucket}
              colorPool={colorPool}
              width="100%"
              flexShrink={1}
            />
          </M.Box>
        </M.Paper>
      )}
    </Data>
  )
}

const useSectionStyles = M.makeStyles((t) => ({
  root: {
    position: 'relative',
    [t.breakpoints.down('xs')]: {
      borderRadius: 0,
      padding: t.spacing(2),
      paddingTop: t.spacing(3),
    },
    [t.breakpoints.up('sm')]: {
      marginTop: t.spacing(2),
      padding: t.spacing(4),
    },
  },
  heading: {
    ...t.typography.h6,
    lineHeight: 1.75,
    marginBottom: t.spacing(1),
    [t.breakpoints.up('sm')]: {
      marginBottom: t.spacing(2),
    },
    [t.breakpoints.up('md')]: {
      ...t.typography.h5,
    },
  },
}))

function Section({ heading, children, ...props }) {
  const classes = useSectionStyles()
  return (
    <M.Paper className={classes.root} {...props}>
      {!!heading && <div className={classes.heading}>{heading}</div>}
      {children}
    </M.Paper>
  )
}

function GettingStarted({ bucket }) {
  const { urls } = NamedRoutes.use()
  return (
    <Section heading="Getting Started">
      <M.Typography>
        Welcome to the Quilt 3 catalog for the <strong>{bucket}</strong> bucket.
        <br />
        For help getting started with Quilt 3 check out{' '}
        <Link to={urls.bucketRoot(EXAMPLE_BUCKET)}>the demo bucket</Link>.
        <br />
        To overwrite this landing page with your own, create a new{' '}
        <strong>README.md</strong> file at the top level of this bucket.
      </M.Typography>
    </Section>
  )
}

function ContentSkel({ lines = 15, ...props }) {
  const widths = React.useMemo(() => R.times(() => 80 + Math.random() * 20, lines), [
    lines,
  ])
  return (
    <M.Box {...props}>
      {widths.map((w, i) => (
        <Skeleton
          // eslint-disable-next-line react/no-array-index-key
          key={i}
          height={16}
          width={`${w}%`}
          borderRadius="borderRadius"
          mt={i ? 1 : 0}
        />
      ))}
    </M.Box>
  )
}

const CrumbLink = M.styled(Link)({ wordBreak: 'break-word' })

function FilePreview({ handle, headingOverride, fallback }) {
  const { urls } = NamedRoutes.use()

  const crumbs = React.useMemo(() => {
    const all = getBreadCrumbs(handle.key)
    const dirs = R.init(all).map(({ label, path }) => ({
      to: urls.bucketFile(handle.bucket, path),
      children: label,
    }))
    const file = {
      to: urls.bucketFile(handle.bucket, handle.key, handle.version),
      children: R.last(all).label,
    }
    return { dirs, file }
  }, [handle, urls])

  const renderCrumbs = () => (
    <span onCopy={copyWithoutSpaces}>
      {crumbs.dirs.map((c) => (
        <React.Fragment key={`crumb:${c.to}`}>
          <CrumbLink {...c} />
          &nbsp;/{' '}
        </React.Fragment>
      ))}
      <CrumbLink {...crumbs.file} />
    </span>
  )

  const heading = headingOverride != null ? headingOverride : renderCrumbs()

  return Preview.load(
    handle,
    AsyncResult.case({
      Ok: AsyncResult.case({
        Init: (_, { fetch }) => (
          <Section heading={heading}>
            <M.Typography variant="body1" gutterBottom>
              Large files are not previewed automatically
            </M.Typography>
            <M.Button variant="outlined" onClick={fetch}>
              Load preview
            </M.Button>
          </Section>
        ),
        Pending: () => (
          <Section heading={heading}>
            <ContentSkel />
          </Section>
        ),
        Err: (_, { fetch }) => (
          <Section heading={heading}>
            <M.Typography variant="body1" gutterBottom>
              Error loading preview
            </M.Typography>
            <M.Button variant="outlined" onClick={fetch}>
              Retry
            </M.Button>
          </Section>
        ),
        Ok: (data) => (
          <Section heading={heading}>
            <M.Box mx="auto">{Preview.render(data)}</M.Box>
          </Section>
        ),
      }),
      Err: Preview.PreviewError.case({
        DoesNotExist: (...args) => (fallback ? fallback(...args) : null),
        _: (_, { fetch }) => (
          <Section heading={heading}>
            <M.Typography variant="body1" gutterBottom>
              Error loading preview
            </M.Typography>
            <M.Button variant="outlined" onClick={fetch}>
              Retry
            </M.Button>
          </Section>
        ),
      }),
      _: () => (
        <Section heading={heading}>
          <ContentSkel />
        </Section>
      ),
    }),
  )
}

const HeadingSkel = (props) => (
  <Skeleton borderRadius="borderRadius" width={200} {...props}>
    &nbsp;
  </Skeleton>
)

const ImageGrid = M.styled(M.Box)(({ theme: t }) => ({
  display: 'grid',
  gridAutoRows: 'max-content',
  gridColumnGap: t.spacing(2),
  gridRowGap: t.spacing(2),
  gridTemplateColumns: '1fr',
  [t.breakpoints.up('sm')]: {
    gridTemplateColumns: '1fr 1fr 1fr',
  },
  [t.breakpoints.up('md')]: {
    gridTemplateColumns: '1fr 1fr 1fr 1fr',
  },
  [t.breakpoints.up('lg')]: {
    gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr',
  },
}))

const useThumbnailsStyles = M.makeStyles({
  link: {
    overflow: 'hidden',
  },
  img: {
    display: 'block',
    marginLeft: 'auto',
    marginRight: 'auto',
    maxWidth: '100%',
  },
})

function Thumbnails({ images }) {
  const classes = useThumbnailsStyles()
  const { urls } = NamedRoutes.use()

  const scrollRef = React.useRef(null)
  const scroll = React.useCallback((prev) => {
    if (prev && scrollRef.current) scrollRef.current.scrollIntoView()
  })

  const pagination = Pagination.use(images, { perPage: 25, onChange: scroll })

  return (
    <Section
      heading={
        <>
          Images ({pagination.from}&ndash;{Math.min(pagination.to, images.length)} of{' '}
          {images.length})
        </>
      }
    >
      <div ref={scrollRef} />
      <ImageGrid>
        {pagination.paginated.map((i) => (
          <Link
            key={i.key}
            to={urls.bucketFile(i.bucket, i.key, i.version)}
            className={classes.link}
          >
            <Thumbnail handle={i} className={classes.img} alt={i.key} title={i.key} />
          </Link>
        ))}
      </ImageGrid>
      {pagination.pages > 1 && (
        <M.Box display="flex" justifyContent="flex-end" pt={2}>
          <Pagination.Controls {...pagination} />
        </M.Box>
      )}
    </Section>
  )
}

const FilePreviewSkel = () => (
  <Section heading={<HeadingSkel />}>
    <ContentSkel />
  </Section>
)

function Readmes({ s3req, overviewUrl, bucket }) {
  return (
    <Data fetch={requests.bucketReadmes} params={{ s3req, overviewUrl, bucket }}>
      {AsyncResult.case({
        Ok: (rs) =>
          rs.discovered.length > 0 || rs.forced ? (
            <>
              {!!rs.forced && (
                <FilePreview
                  key="readme:forced"
                  headingOverride={false}
                  handle={rs.forced}
                />
              )}
              {rs.discovered.map((h) => (
                <FilePreview key={`readme:${h.bucket}/${h.key}`} handle={h} />
              ))}
            </>
          ) : (
            <GettingStarted bucket={bucket} />
          ),
        _: () => <FilePreviewSkel key="readme:skeleton" />,
      })}
    </Data>
  )
}

function Imgs({ es, s3req, overviewUrl, inStack, bucket }) {
  return (
    <Data
      fetch={requests.bucketImgs}
      params={{ es, s3req, overviewUrl, inStack, bucket }}
    >
      {AsyncResult.case({
        Ok: (images) => (images.length ? <Thumbnails images={images} /> : null),
        _: () => (
          <Section key="thumbs:skel" heading={<HeadingSkel />}>
            <ImageGrid>
              {R.times(
                (i) => (
                  // eslint-disable-next-line react/no-array-index-key
                  <Skeleton key={i} height={200} />
                ),
                9,
              )}
            </ImageGrid>
          </Section>
        ),
      })}
    </Data>
  )
}

function Summary({ es, s3req, bucket, inStack, overviewUrl }) {
  return (
    <Data
      fetch={requests.bucketSummary}
      params={{ es, s3req, bucket, inStack, overviewUrl }}
    >
      {AsyncResult.case({
        Ok: R.map((h) => <FilePreview key={`${h.bucket}/${h.key}`} handle={h} />),
        Pending: () => <FilePreviewSkel />,
        _: () => null,
      })}
    </Data>
  )
}

export default function Overview({
  match: {
    params: { bucket },
  },
}) {
  const s3req = AWS.S3.useRequest()
  const { shouldSign } = Config.useConfig()
  const es = AWS.ES.use({ sign: shouldSign(bucket) })
  const cfg = BucketConfig.useCurrentBucketConfig()
  const inStack = !!cfg
  const overviewUrl = cfg && cfg.overviewUrl
  const description = cfg && cfg.description
  return (
    <Data fetch={requests.bucketExists} params={{ s3req, bucket }}>
      {AsyncResult.case({
        Ok: () => (
          <M.Box pb={{ xs: 0, sm: 4 }} mx={{ xs: -2, sm: 0 }}>
            {!!cfg && cfg.relevance >= 0 && (
              <React.Suspense fallback={null}>
                <LinkedData.BucketData bucket={cfg} />
              </React.Suspense>
            )}
            {cfg ? (
              <Head {...{ es, s3req, bucket, overviewUrl, description }} />
            ) : (
              <M.Box
                pt={2}
                pb={{ xs: 2, sm: 0 }}
                px={{ xs: 2, sm: 0 }}
                textAlign={{ xs: 'center', sm: 'left' }}
              >
                <M.Typography variant="h5">{bucket}</M.Typography>
              </M.Box>
            )}
            <Readmes {...{ s3req, bucket, overviewUrl }} />
            <Imgs {...{ es, s3req, bucket, inStack, overviewUrl }} />
            <Summary {...{ es, s3req, bucket, inStack, overviewUrl }} />
          </M.Box>
        ),
        Err: displayError(),
        _: () => <Placeholder color="text.secondary" />,
      })}
    </Data>
  )
}
