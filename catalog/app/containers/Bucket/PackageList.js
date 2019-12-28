import { push } from 'connected-react-router'
import * as dateFns from 'date-fns'
import * as R from 'ramda'
import * as React from 'react'
import { FormattedRelative, FormattedPlural } from 'react-intl'
import * as redux from 'react-redux'
import { Link } from 'react-router-dom'
import * as M from '@material-ui/core'
import { fade } from '@material-ui/core/styles'

import Message from 'components/Message'
import Sparkline from 'components/Sparkline'
import * as AWS from 'utils/AWS'
import AsyncResult from 'utils/AsyncResult'
import * as BucketConfig from 'utils/BucketConfig'
import * as Config from 'utils/Config'
import * as Data from 'utils/Data'
import * as LinkedData from 'utils/LinkedData'
import * as NamedRoutes from 'utils/NamedRoutes'
import StyledLink from 'utils/StyledLink'
import * as SVG from 'utils/SVG'
import parseSearch from 'utils/parseSearch'
import { readableQuantity } from 'utils/string'
import useDebouncedInput from 'utils/useDebouncedInput'
import usePrevious from 'utils/usePrevious'

import Pagination from './Pagination'
import { displayError } from './errors'
import * as requests from './requests'

const EXAMPLE_PACKAGE_URL =
  'https://open.quiltdata.com/b/quilt-example/packages/aleksey/hurdat/tree/latest/'

const Counts = ({ counts, total }) => {
  const [cursor, setCursor] = React.useState(null)
  const t = M.useTheme()
  const xs = M.useMediaQuery(t.breakpoints.down('xs'))
  const sm = M.useMediaQuery(t.breakpoints.down('sm'))
  // eslint-disable-next-line no-nested-ternary
  const sparklineW = xs ? 176 : sm ? 300 : 400
  const sparklineH = xs ? 32 : 40
  return (
    <M.Box position="absolute" right={0} top={0} bottom={0}>
      <M.Box position="absolute" right={16} top={16}>
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
    </M.Box>
  )
}

const usePackageStyles = M.makeStyles((t) => ({
  root: {
    position: 'relative',

    [t.breakpoints.down('xs')]: {
      borderRadius: 0,
    },

    [t.breakpoints.up('sm')]: {
      marginTop: t.spacing(1),
    },
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
  handle: {
    fontSize: t.typography.pxToRem(16),
    fontWeight: t.typography.fontWeightMedium,
    lineHeight: t.typography.pxToRem(20),
  },
  handleText: {
    position: 'relative',
  },
  handleClickArea: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,

    '$handle:hover &': {
      background: t.palette.action.hover,
    },
  },
  revisions: {
    ...t.typography.subtitle2,
    color: t.palette.text.secondary,
    position: 'relative',
  },
  updated: {
    ...t.typography.body2,
    color: t.palette.text.secondary,
    position: 'relative',
  },
}))

function Package({ name, modified, revisions, revisionsTruncated, bucket, views }) {
  const { urls } = NamedRoutes.use()
  const classes = usePackageStyles()
  const t = M.useTheme()
  const xs = M.useMediaQuery(t.breakpoints.down('xs'))
  return (
    <M.Paper className={classes.root}>
      <div className={classes.handleContainer}>
        <Link className={classes.handle} to={urls.bucketPackageDetail(bucket, name)}>
          <span className={classes.handleClickArea} />
          <span className={classes.handleText}>{name}</span>
        </Link>
      </div>
      <M.Box pl={2} pb={2} pt={1}>
        <span className={classes.revisions}>
          {revisions}
          {revisionsTruncated && '+'}{' '}
          {xs ? (
            'Rev.'
          ) : (
            <FormattedPlural one="Revision" other="Revisions" value={revisions} />
          )}
        </span>
        <M.Box mr={2} component="span" />
        <span className={classes.updated}>
          {xs ? 'Upd. ' : 'Updated '}
          {modified ? <FormattedRelative value={modified} /> : '[unknown: see console]'}
        </span>
      </M.Box>
      {!!views && <Counts {...views} />}
    </M.Paper>
  )
}

const SORT_OPTIONS = [
  { key: 'name', label: 'Name', by: R.prop('name') },
  { key: 'views', label: 'Views', by: (p) => (p.views && -p.views.total) || 0 },
  { key: 'modified', label: 'Updated', by: (p) => -p.modified },
]

const DEFAULT_SORT = SORT_OPTIONS[0]

const getSort = (key) => (key && SORT_OPTIONS.find((o) => o.key === key)) || DEFAULT_SORT

const useSortDropdownStyles = M.makeStyles((t) => ({
  root: {
    paddingBottom: t.spacing(1),
    paddingLeft: t.spacing(1.5),
    paddingTop: t.spacing(1),
    textTransform: 'none',
    ...t.typography.body1,
  },
}))

function SortDropdown({ value, options, makeSortUrl }) {
  const t = M.useTheme()
  const xs = M.useMediaQuery(t.breakpoints.down('xs'))
  const classes = useSortDropdownStyles()
  const [anchor, setAnchor] = React.useState(null)
  const open = React.useCallback(
    (evt) => {
      setAnchor(evt.target)
    },
    [setAnchor],
  )
  const close = React.useCallback(() => {
    setAnchor(null)
  }, [setAnchor])

  const selected = getSort(value)

  return (
    <>
      {xs ? (
        <M.IconButton onClick={open}>
          <M.Icon>sort</M.Icon>
        </M.IconButton>
      ) : (
        <M.Button onClick={open} className={classes.root}>
          Sort by:
          <M.Box component="span" fontWeight="fontWeightMedium" ml={1}>
            {selected.label}
          </M.Box>
          <M.Icon>expand_more</M.Icon>
        </M.Button>
      )}
      <M.Menu anchorEl={anchor} open={!!anchor} onClose={close}>
        {options.map((o) => (
          <M.MenuItem
            onClick={close}
            component={Link}
            to={makeSortUrl(o.key)}
            key={o.key}
            selected={o.key === value}
          >
            {o.label}
          </M.MenuItem>
        ))}
      </M.Menu>
    </>
  )
}

const usePackagesStyles = M.makeStyles((t) => ({
  paper: {
    [t.breakpoints.down('xs')]: {
      borderRadius: 0,
      boxShadow: 'none',
    },
  },
  searchIcon: {
    left: 8,
    pointerEvents: 'none',
    position: 'absolute',
  },
  input: {
    paddingLeft: t.spacing(5),
    paddingRight: t.spacing(5),
    paddingBottom: 11,
    paddingTop: 10,
    [t.breakpoints.down('xs')]: {
      paddingBottom: 15,
      paddingTop: 14,
    },
  },
}))

const PER_PAGE = 30

function Packages({ packages, bucket, filter, sort, page }) {
  const dispatch = redux.useDispatch()
  const { urls } = NamedRoutes.use()
  const t = M.useTheme()
  const xs = M.useMediaQuery(t.breakpoints.down('xs'))
  const classes = usePackagesStyles()

  const scrollRef = React.useRef(null)

  const actualSort = getSort(sort)
  const actualPage = page || 1
  const actualFilter = filter || ''
  const filtering = useDebouncedInput(actualFilter, 200)

  const filtered = React.useMemo(
    () =>
      filtering.value
        ? packages.filter((p) =>
            p.name.toLowerCase().includes(filtering.value.toLowerCase()),
          )
        : packages,
    [filtering.value, packages],
  )

  React.useEffect(() => {
    if (filtering.value !== actualFilter) {
      dispatch(
        push(
          urls.bucketPackageList(bucket, { filter: filtering.value || undefined, sort }),
        ),
      )
    }
  }, [filtering.value, actualFilter, dispatch, bucket, sort])

  const makeSortUrl = React.useCallback(
    (s) =>
      urls.bucketPackageList(bucket, {
        filter,
        sort: s === DEFAULT_SORT.key ? undefined : s,
        // reset page if sort order changed
        p: s === actualSort.key ? page : undefined,
      }),
    [bucket, filter, page],
  )

  const sorted = React.useMemo(() => R.sortBy(actualSort.by, filtered), [
    actualSort.by,
    filtered,
  ])

  const makePageUrl = React.useCallback(
    (p) => urls.bucketPackageList(bucket, { filter, sort, p: p !== 1 ? p : undefined }),
    [bucket, filter, sort],
  )

  const pages = Math.ceil(sorted.length / PER_PAGE)

  const paginated = React.useMemo(
    () =>
      pages === 1
        ? sorted
        : sorted.slice((actualPage - 1) * PER_PAGE, actualPage * PER_PAGE),
    [sorted, actualPage],
  )

  usePrevious(actualPage, (prev) => {
    if (prev && actualPage !== prev && scrollRef.current) {
      scrollRef.current.scrollIntoView()
    }
  })

  return packages.length ? (
    <M.Box pb={xs ? 0 : 5} mx={xs ? -2 : 0}>
      <M.Box display="flex" mt={{ xs: 0, sm: 3 }} ref={scrollRef}>
        <M.Box
          component={M.Paper}
          className={classes.paper}
          flexGrow={{ xs: 1, sm: 0 }}
          position="relative"
        >
          <M.InputBase
            {...filtering.input}
            placeholder="Find a package"
            classes={{ input: classes.input }}
            fullWidth
            startAdornment={<M.Icon className={classes.searchIcon}>search</M.Icon>}
            endAdornment={
              <M.Fade in={!!filtering.input.value}>
                <M.Box
                  position="absolute"
                  right={-4}
                  component={M.IconButton}
                  onClick={() => filtering.set('')}
                >
                  <M.Icon>clear</M.Icon>
                </M.Box>
              </M.Fade>
            }
          />
        </M.Box>
        <M.Box flexGrow={1} display={{ xs: 'none', sm: 'block' }} />
        <M.Box component={M.Paper} className={classes.paper}>
          <SortDropdown
            value={actualSort.key}
            options={SORT_OPTIONS}
            makeSortUrl={makeSortUrl}
          />
        </M.Box>
      </M.Box>

      {!!filtering.value && !filtered.length && (
        <M.Box
          borderTop={{ xs: 1, sm: 0 }}
          borderColor="divider"
          pt={3}
          px={{ xs: 2, sm: 0 }}
        >
          <M.Typography variant="h5">No matching packages found</M.Typography>
        </M.Box>
      )}

      {paginated.map((pkg) => (
        <Package key={pkg.name} {...pkg} bucket={bucket} />
      ))}

      {pages > 1 && <Pagination {...{ pages, page: actualPage, makePageUrl }} />}
    </M.Box>
  ) : (
    <Message headline="No packages">
      Learn how to <StyledLink href={EXAMPLE_PACKAGE_URL}>create a package</StyledLink>
    </Message>
  )
}

export default function PackageList({
  match: {
    params: { bucket },
  },
  location,
}) {
  const { filter, sort, p } = parseSearch(location.search)
  const page = p && parseInt(p, 10)
  const s3req = AWS.S3.useRequest()
  const sign = AWS.Signer.useS3Signer()
  const { analyticsBucket, apiGatewayEndpoint: endpoint } = Config.useConfig()
  const bucketCfg = BucketConfig.useCurrentBucketConfig()
  const today = React.useMemo(() => new Date(), [])
  const data = Data.use(requests.listPackages, { s3req, analyticsBucket, bucket, today })
  return data.case({
    _: () => (
      <M.Box display="flex" pt={5} justifyContent="center">
        <M.CircularProgress />
      </M.Box>
    ),
    Err: displayError(),
    Ok: (packages) => (
      <>
        <Packages {...{ packages, bucket, filter, sort, page }} />
        {!!bucketCfg &&
          packages.map(({ name }) => (
            <Data.Fetcher
              key={name}
              fetch={requests.getRevisionData}
              params={{ s3req, sign, endpoint, bucket, name, id: 'latest', maxKeys: 0 }}
            >
              {AsyncResult.case({
                _: () => null,
                Ok: ({ hash, modified, header }) => (
                  <React.Suspense fallback={null}>
                    <LinkedData.PackageData
                      {...{
                        bucket: bucketCfg,
                        name,
                        revision: 'latest',
                        hash,
                        modified,
                        header,
                      }}
                    />
                  </React.Suspense>
                ),
              })}
            </Data.Fetcher>
          ))}
      </>
    ),
  })
}
