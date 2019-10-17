import cx from 'classnames'
import * as dateFns from 'date-fns'
import * as R from 'ramda'
import * as React from 'react'
import * as M from '@material-ui/core'
import { fade } from '@material-ui/core/styles'
import useComponentSize from '@rehooks/component-size'

import Message from 'components/Message'
import * as Pagination from 'components/Pagination'
import Placeholder from 'components/Placeholder'
import * as Preview from 'components/Preview'
import Skeleton from 'components/Skeleton'
import MultiSparkline from 'components/Sparkline/Multi'
import Thumbnail from 'components/Thumbnail'
import * as AWS from 'utils/AWS'
import AsyncResult from 'utils/AsyncResult'
import * as BucketConfig from 'utils/BucketConfig'
import * as Config from 'utils/Config'
import Data from 'utils/Data'
import * as NamedRoutes from 'utils/NamedRoutes'
import * as SVG from 'utils/SVG'
import Link from 'utils/StyledLink'
import { getBreadCrumbs } from 'utils/s3paths'
import { readableBytes, readableQuantity } from 'utils/string'
import useMemoEq from 'utils/useMemoEq'

import { displayError } from './errors'
import * as requests from './requests'

import bg from './Overview-bg.jpg'

const RODA_LINK = 'https://registry.opendata.aws'
const EXAMPLE_BUCKET = 'quilt-example'
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
  selected: {},
  ext: {
    color: t.palette.text.secondary,
    gridColumn: 1,
    fontSize: t.typography.overline.fontSize,
    fontWeight: t.typography.fontWeightMedium,
    letterSpacing: t.typography.subtitle2.letterSpacing,
    lineHeight: t.typography.pxToRem(20),
    textAlign: 'right',
    '&$selected': {
      color: t.palette.text.primary,
    },
  },
  count: {
    color: t.palette.text.secondary,
    gridColumn: 3,
    fontSize: t.typography.overline.fontSize,
    fontWeight: t.typography.fontWeightMedium,
    letterSpacing: t.typography.subtitle2.letterSpacing,
    lineHeight: t.typography.pxToRem(20),
    '&$selected': {
      color: t.palette.text.primary,
    },
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
    '&$flip$selected': {
      color: t.palette.text.primary,
    },
  },
  skeleton: {
    gridColumn: '1 / span 3',
  },
}))

function ObjectsByExt({ data, cursor, ...props }) {
  const classes = useObjectsByExtStyles()
  return (
    <M.Box className={classes.root} {...props}>
      <div className={classes.heading}>Objects by File Extension</div>
      {AsyncResult.case(
        {
          Ok: (exts) => {
            const maxBytes = exts.reduce((max, e) => Math.max(max, e.bytes), 0)
            return exts.map(({ ext, bytes, objects }, i) => {
              const selected = !!cursor && cursor.i === i
              const color = COLOR_MAP[i]
              return (
                <React.Fragment key={`ext:${ext}`}>
                  <div
                    className={cx(classes.ext, {
                      [classes.selected]: selected,
                    })}
                    style={{ gridRow: i + 2 }}
                  >
                    {ext || 'other'}
                  </div>
                  <div className={classes.bar} style={{ gridRow: i + 2 }}>
                    <div
                      className={classes.gauge}
                      style={{
                        background: cursor == null || selected ? color : fade(color, 0.4),
                        width: `${(bytes / maxBytes) * 100}%`,
                      }}
                    >
                      <div
                        className={cx(classes.size, {
                          [classes.flip]: bytes / maxBytes < 0.3,
                          [classes.selected]: selected,
                        })}
                      >
                        {readableBytes(bytes)}
                      </div>
                    </div>
                  </div>
                  <div
                    className={cx(classes.count, {
                      [classes.selected]: selected,
                    })}
                    style={{ gridRow: i + 2 }}
                  >
                    {readableQuantity(objects)}
                  </div>
                </React.Fragment>
              )
            })
          },
          _: () =>
            R.times(
              (i) => <Skeleton key={`skeleton:${i}`} className={classes.skeleton} />,
              MAX_EXTS,
            ),
        },
        data,
      )}
    </M.Box>
  )
}

const rnd = ({ i, j, window, lines, stagger, grow, spread, spreadGrow }) =>
  i * stagger +
  ((((i + 1) / lines) * (j + 1)) / window) * grow +
  Math.random() * (spread + ((((j + 1) / window) * (i + 1)) / lines) * spreadGrow)

function SparklineSkel({ height, width, lines, window = 30, animate = false, children }) {
  const data = React.useMemo(
    () =>
      R.times(
        (i) =>
          R.times(
            (j) =>
              rnd({ i, j, window, lines, stagger: 1, grow: 6, spread: 3, spreadGrow: 1 }),
            window,
          ),
        lines,
      ),
    [lines, window],
  )
  const t = M.useTheme()
  const c1 = t.palette.grey[300]
  const c2 = t.palette.grey[100]
  const stroke = React.useMemo(
    () =>
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
      ),
    [c1, c2, animate],
  )
  return (
    <M.Box position="relative">
      <MultiSparkline
        data={data}
        width={width}
        height={height}
        lineThickness={2}
        extendL
        extendR
        padding={5}
        pt={10}
        lineStroke={stroke}
      />
      {children}
    </M.Box>
  )
}

const ANALYTICS_WINDOW_OPTIONS = [
  { value: 30, label: 'Last 30 days' },
  { value: 365, label: 'Last 365 days' },
]

function DownloadsRange({ value, onChange }) {
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
      <M.Button variant="outlined" size="small" __color="inherit" onClick={open}>
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
      </M.Menu>
    </>
  )
}
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

const Memo = ({ args, process, children }) => children(useMemoEq(args, R.apply(process)))

const withMemo = (process, next) => (...args) => (
  <Memo {...{ args, process }}>{next}</Memo>
)

function Downloads({ exts, bucket, cursor, onCursor, ...props }) {
  const { analyticsBucket } = Config.useConfig()
  const s3req = AWS.S3.useRequest()
  const today = React.useMemo(() => new Date(), [])
  const classes = useDownloadsStyles()
  const ref = React.useRef(null)
  const { width } = useComponentSize(ref)
  const strokes = COLOR_MAP.map(SVG.Paint.Color)
  const [window, setWindow] = React.useState(ANALYTICS_WINDOW_OPTIONS[0].value)
  return (
    <M.Box className={classes.root} {...props} ref={ref}>
      <div className={classes.period}>
        <DownloadsRange value={window} onChange={setWindow} />
      </div>
      <Data
        fetch={requests.bucketAccessCounts}
        params={{ s3req, analyticsBucket, bucket, today, window }}
      >
        {withMemo(
          // TODO: it wont update if exts change
          AsyncResult.case({
            _: R.identity,
            Ok: (counts) =>
              AsyncResult.mapCase(
                {
                  Ok: R.pipe(
                    R.map((e) => counts[e.ext] || []),
                    R.applySpec({
                      dates: R.map(R.pluck('date')),
                      values: R.map(R.pluck('value')),
                    }),
                  ),
                },
                exts,
              ),
          }),
          (data) => (
            <>
              <div className={classes.heading}>
                {AsyncResult.case(
                  {
                    Ok: ({ dates, values }) => {
                      if (!cursor) return 'Downloads'
                      const date = dates[cursor.i][cursor.j]
                      const value = values[cursor.i][cursor.j]
                      return (
                        <>
                          {dateFns.format(date, 'MMMM Do')}: {readableQuantity(value)}
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
                    Ok: ({ values }) => {
                      // use the same height as the bar chart: 20px per bar with 2px margin
                      const chartH = 22 * Math.max(3, values.length) - 2
                      if (values.every(R.isEmpty))
                        return (
                          <SparklineSkel
                            height={chartH}
                            lines={values.length}
                            width={width}
                          >
                            <div className={classes.unavail}>Requires CloudTrail</div>
                          </SparklineSkel>
                        )
                      return (
                        <MultiSparkline
                          data={values}
                          cursor={cursor}
                          onCursor={onCursor}
                          height={chartH}
                          width={width}
                          lineThickness={2}
                          cursorLineThickness={3}
                          cursorCircleR={4}
                          lineStrokes={strokes}
                          extendL
                          extendR
                          cursorCircleFill={SVG.Paint.Color('#fff')}
                          padding={6}
                          pt={12}
                        />
                      )
                    },
                    _: () => (
                      <SparklineSkel
                        height={22 * MAX_EXTS - 2}
                        lines={MAX_EXTS}
                        width={width}
                        animate
                      />
                    ),
                  },
                  data,
                )}
              </div>
            </>
          ),
        )}
      </Data>
    </M.Box>
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

function StatDisplay({ value, label, format = R.identity }) {
  const classes = useStatDisplayStyles()
  return AsyncResult.case(
    {
      Ok: (v) => (
        <span className={classes.root}>
          <span className={classes.value}>{format(v)}</span>
          {!!label && <span className={classes.label}>{label}</span>}
        </span>
      ),
      _: () => (
        <div className={cx(classes.root, classes.skeletonContainer)}>
          <Skeleton className={classes.skeleton} bgcolor="grey.400" />
        </div>
      ),
    },
    value,
  )
}

const useHeadStyles = M.makeStyles((t) => ({
  root: {
    overflow: 'hidden',
    position: 'relative',
    [t.breakpoints.down('xs')]: {
      borderRadius: 0,
    },
    [t.breakpoints.up('sm')]: {
      marginTop: t.spacing(2),
    },
  },
  top: {
    paddingBottom: t.spacing(3),
    paddingLeft: t.spacing(2),
    paddingRight: t.spacing(2),
    paddingTop: t.spacing(4),
    position: 'relative',
    color: t.palette.common.white,
    background: `center / cover url(${bg}) ${t.palette.grey[700]}`,
    [t.breakpoints.up('sm')]: {
      padding: t.spacing(4),
    },
  },
  lock: {
    alignItems: 'center',
    background: fade(t.palette.grey[500], 0.7),
    bottom: 0,
    color: t.palette.common.white,
    display: 'flex',
    justifyContent: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
}))

function Head({ s3req, overviewUrl, bucket, description }) {
  const classes = useHeadStyles()
  const [cursor, setCursor] = React.useState(null)
  const isRODA = overviewUrl.includes('/quilt-open-data-bucket/')
  return (
    <Data fetch={requests.bucketStats} params={{ s3req, overviewUrl, maxExts: MAX_EXTS }}>
      {(res) => (
        <M.Paper className={classes.root}>
          <M.Box className={classes.top}>
            <M.Typography variant="h5">{bucket}</M.Typography>
            {!!description && (
              <M.Box mt={1}>
                <M.Typography variant="body1">{description}</M.Typography>
              </M.Box>
            )}
            <M.Box
              mt={1}
              position={{ md: 'absolute' }}
              right={{ md: 32 }}
              bottom={{ md: 31 }}
              color="grey.300"
              textAlign={{ md: 'right' }}
            >
              {AsyncResult.case(
                {
                  Ok: (r) => (
                    <M.Typography variant="body2">
                      Updated{' '}
                      {r.updated
                        ? dateFns.distanceInWordsToNow(r.updated, { addSuffix: true })
                        : 'never'}
                    </M.Typography>
                  ),
                  _: () => (
                    <M.Box display="flex" alignItems="center" height={20}>
                      <Skeleton
                        height={14}
                        width={120}
                        borderRadius="borderRadius"
                        bgcolor="grey.400"
                      />
                    </M.Box>
                  ),
                },
                res,
              )}
              {isRODA && (
                <M.Typography variant="body2">
                  From the{' '}
                  <M.Link href={RODA_LINK} color="inherit" underline="always">
                    Registry of Open Data on AWS
                  </M.Link>
                </M.Typography>
              )}
            </M.Box>
            <M.Box mt={{ xs: 2, sm: 3 }} display="flex" alignItems="baseline">
              <StatDisplay
                value={AsyncResult.prop('totalObjects', res)}
                format={readableQuantity}
                label="Objects"
              />
              <StatDisplay
                value={AsyncResult.prop('totalBytes', res)}
                format={readableBytes}
              />
            </M.Box>
          </M.Box>
          <M.Box
            p={{ xs: 2, sm: 4 }}
            display="flex"
            flexDirection={{ xs: 'column', md: 'row' }}
            position="relative"
          >
            <ObjectsByExt
              data={AsyncResult.prop('exts', res)}
              width="100%"
              flexShrink={1}
              cursor={cursor}
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
              exts={AsyncResult.prop('exts', res)}
              width="100%"
              flexShrink={1}
              cursor={cursor}
              onCursor={setCursor}
            />
            {AsyncResult.Err.is(res) && (
              <div className={classes.lock}>
                <M.Typography variant="h5" align="center">
                  Indexing in progress
                  <br />
                  <br />
                  <M.CircularProgress color="inherit" size={64} />
                </M.Typography>
              </div>
            )}
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

  const handleCopy = React.useCallback((e) => {
    if (typeof document === 'undefined') return
    e.clipboardData.setData(
      'text/plain',
      document
        .getSelection()
        .toString()
        .replace(/\s*\/\s*/g, '/'),
    )
    e.preventDefault()
  }, [])

  const renderCrumbs = () => (
    <span onCopy={handleCopy}>
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

const MAX_PREVIEWS = 10

function Summarize({ summarize, other, children }) {
  const s3req = AWS.S3.useRequest()
  return AsyncResult.case(
    {
      _: children,
      Ok: (handle) =>
        handle ? (
          <Data fetch={requests.summarize} params={{ s3req, handle }}>
            {AsyncResult.case({
              _: children,
              Ok: (summary) =>
                AsyncResult.case(
                  {
                    _: children,
                    Ok: (otherHandles) => {
                      const handles =
                        summary.length >= MAX_PREVIEWS
                          ? summary
                          : summary.concat(otherHandles).slice(0, MAX_PREVIEWS)
                      return children(AsyncResult.Ok(handles))
                    },
                  },
                  other,
                ),
            })}
          </Data>
        ) : (
          children(other)
        ),
    },
    summarize,
  )
}

const README_BUCKET = 'quilt-open-data-bucket' // TODO: unhardcode

function Files({ s3req, overviewUrl, bucket }) {
  return (
    <Data fetch={requests.bucketSummary} params={{ s3req, overviewUrl, bucket }}>
      {(res) => (
        <>
          <FilePreview
            key="readme:configured"
            headingOverride={false}
            handle={{ bucket: README_BUCKET, key: `${bucket}/README.md` }}
            fallback={() =>
              AsyncResult.case(
                {
                  Ok: ({ readmes }) =>
                    !readmes.length && <GettingStarted bucket={bucket} />,
                  // only show error if there's nothing more to show
                  Err: displayError([
                    [
                      R.T,
                      () => (
                        // TODO: proper copy
                        <Message headline="Error">Unable to load bucket summary</Message>
                      ),
                    ],
                  ]),
                  _: () => null,
                },
                res,
              )
            }
          />
          {AsyncResult.case(
            {
              Err: () => null,
              _: R.juxt([
                AsyncResult.case({
                  Ok: ({ readmes }) =>
                    readmes.map((h) => (
                      <FilePreview key={`readme:${h.bucket}/${h.key}`} handle={h} />
                    )),
                  _: () => <FilePreviewSkel key="readme:skeleton" />,
                }),
                AsyncResult.case({
                  Ok: ({ images }) => {
                    if (!images.length) return null
                    return <Thumbnails key="thumbs" images={images} />
                  },
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
                }),
                () => (
                  <Summarize
                    key="summarize"
                    {...AsyncResult.props(['summarize', 'other'], res)}
                  >
                    {AsyncResult.case({
                      Ok: R.map((h) => (
                        <FilePreview key={`${h.bucket}/${h.key}`} handle={h} />
                      )),
                      _: () => <FilePreviewSkel />,
                    })}
                  </Summarize>
                ),
              ]),
            },
            res,
          )}
        </>
      )}
    </Data>
  )
}

export default function Overview({
  match: {
    params: { bucket },
  },
}) {
  const s3req = AWS.S3.useRequest()
  const cfg = BucketConfig.useCurrentBucketConfig()
  return (
    <Data fetch={requests.bucketExists} params={{ s3req, bucket }}>
      {AsyncResult.case({
        Ok: () =>
          cfg ? (
            <M.Box pb={{ xs: 0, sm: 4 }} mx={{ xs: -2, sm: 0 }}>
              <Head
                {...{
                  s3req,
                  overviewUrl: cfg.overviewUrl,
                  bucket,
                  description: cfg.description,
                }}
              />
              <Files {...{ s3req, overviewUrl: cfg.overviewUrl, bucket }} />
            </M.Box>
          ) : (
            // TODO: revise content / copy
            <Message headline="Error">Overview unavailable for this bucket</Message>
          ),
        Err: displayError(),
        _: () => <Placeholder />,
      })}
    </Data>
  )
}
