import * as dateFns from 'date-fns'
import * as R from 'ramda'
import * as React from 'react'
import * as RRDom from 'react-router-dom'
import * as M from '@material-ui/core'
import { fade } from '@material-ui/core/styles'
import type { ResultOf } from '@graphql-typed-document-node/core'

import Skeleton from 'components/Skeleton'
import Sparkline from 'components/Sparkline'
import * as Model from 'model'
import * as BucketPreferences from 'utils/BucketPreferences'
import MetaTitle from 'utils/MetaTitle'
import * as NamedRoutes from 'utils/NamedRoutes'
import * as SVG from 'utils/SVG'
import StyledLink from 'utils/StyledLink'
import * as Format from 'utils/format'
import parseSearch from 'utils/parseSearch'
import mkStorage from 'utils/storage'
import { readableQuantity } from 'utils/string'
import useDebouncedInput from 'utils/useDebouncedInput'
import usePrevious from 'utils/usePrevious'
import useQuery from 'utils/useQuery'

import * as PD from '../PackageDialog'
import Pagination from '../Pagination'
import WithPackagesSupport from '../WithPackagesSupport'
import { displayError } from '../errors'

import PACKAGE_COUNT_QUERY from './gql/PackageCount.generated'
import PACKAGE_LIST_QUERY from './gql/PackageList.generated'

const EXAMPLE_PACKAGE_URL = 'https://docs.quiltdata.com/walkthrough/editing-a-package'

const PER_PAGE = 30

const SORT_OPTIONS = [
  {
    key: 'modified',
    value: Model.GQLTypes.PackageListOrder.MODIFIED,
    label: 'Updated',
  },
  {
    key: 'name',
    value: Model.GQLTypes.PackageListOrder.NAME,
    label: 'Name',
  },
] as const

type SortMode = typeof SORT_OPTIONS[number]['key']

const DEFAULT_SORT = SORT_OPTIONS[0]

// Possible values are 'modified', 'name'
const storage = mkStorage({ sortPackagesBy: 'SORT_PACKAGES_BY' })

const getSort = (key: unknown) => {
  if (!key) return DEFAULT_SORT
  return SORT_OPTIONS.find((o) => o.key === key) || DEFAULT_SORT
}

type CountsProps = NonNullable<
  NonNullable<
    ResultOf<typeof PACKAGE_LIST_QUERY>['packages']
  >['page'][number]['accessCounts']
>

function Counts({ counts, total }: CountsProps) {
  const [cursor, setCursor] = React.useState<number | null>(null)
  const t = M.useTheme()
  const xs = M.useMediaQuery(t.breakpoints.down('xs'))
  const sm = M.useMediaQuery(t.breakpoints.down('sm'))
  // eslint-disable-next-line no-nested-ternary
  const sparklineW = xs ? 176 : sm ? 300 : 400
  const sparklineH = xs ? 32 : 40
  return (
    <M.Box position="absolute" right={0} top={0} bottom={0}>
      <M.Box position="absolute" right={16} top={16} whiteSpace="nowrap">
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

type PackageProps = NonNullable<
  ResultOf<typeof PACKAGE_LIST_QUERY>['packages']
>['page'][number]

function Package({ name, modified, revisions, bucket, accessCounts }: PackageProps) {
  const { urls } = NamedRoutes.use()
  const classes = usePackageStyles()
  const t = M.useTheme()
  const xs = M.useMediaQuery(t.breakpoints.down('xs'))
  return (
    <M.Paper className={classes.root}>
      <div className={classes.handleContainer}>
        <RRDom.Link
          className={classes.handle}
          to={urls.bucketPackageDetail(bucket, name)}
        >
          <span className={classes.handleClickArea} />
          <span className={classes.handleText}>{name}</span>
        </RRDom.Link>
      </div>
      <M.Box pl={2} pb={2} pt={1}>
        <span className={classes.revisions}>
          {revisions.total}{' '}
          {xs ? (
            'Rev.'
          ) : (
            <Format.Plural value={revisions.total} one="Revision" other="Revisions" />
          )}
        </span>
        <M.Box mr={2} component="span" />
        <span
          className={classes.updated}
          title={modified ? modified.toString() : undefined}
        >
          {xs ? 'Upd. ' : 'Updated '}
          {modified ? <Format.Relative value={modified} /> : '[unknown: see console]'}
        </span>
      </M.Box>
      {!!accessCounts && <Counts {...accessCounts} />}
    </M.Paper>
  )
}

function PackageSkel() {
  const classes = usePackageStyles()
  return (
    <M.Paper className={classes.root}>
      <M.Box p={2}>
        <Skeleton height={20} width="50%" borderRadius="borderRadius" />
        <Skeleton mt={1} height={20} width="70%" borderRadius="borderRadius" />
      </M.Box>
    </M.Paper>
  )
}

const useSortDropdownStyles = M.makeStyles((t) => ({
  root: {
    paddingBottom: t.spacing(1),
    paddingLeft: t.spacing(1.5),
    paddingTop: t.spacing(1),
    textTransform: 'none',
    ...t.typography.body1,
  },
}))

interface SortDropdownProps {
  value: SortMode
  options: typeof SORT_OPTIONS
  makeSortUrl: (mode: SortMode) => string
}

function SortDropdown({ value, options, makeSortUrl }: SortDropdownProps) {
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

  const handleClick = React.useCallback(
    (key) => {
      storage.set('sortPackagesBy', key)
      close()
    },
    [close],
  )

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
            onClick={() => handleClick(o.key)}
            component={RRDom.Link}
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

const useStyles = M.makeStyles((t) => ({
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
  clear: {
    position: 'absolute',
    right: -4,
  },
}))

interface PackageListProps {
  bucket: string
  sort?: string
  filter?: string
  page?: number
}

function PackageList({ bucket, sort, filter, page }: PackageListProps) {
  const history = RRDom.useHistory()
  const { urls } = NamedRoutes.use()
  const classes = useStyles()

  const scrollRef = React.useRef<HTMLDivElement | null>(null)

  const computedPage = page || 1
  const computedSort = getSort(sort)
  const computedFilter = filter || ''
  const filtering = useDebouncedInput(computedFilter, 500)

  const totalCountQuery = useQuery({
    query: PACKAGE_COUNT_QUERY,
    variables: { bucket, filter: null },
  })

  const filteredCountQuery = useQuery({
    query: PACKAGE_COUNT_QUERY,
    variables: { bucket, filter: filter || null },
  })

  const packagesQuery = useQuery({
    query: PACKAGE_LIST_QUERY,
    variables: {
      bucket,
      filter: filter || null,
      order: computedSort.value,
      page: computedPage,
      perPage: PER_PAGE,
    },
  })

  const makeSortUrl = React.useCallback(
    (s) =>
      urls.bucketPackageList(bucket, {
        filter,
        sort: s === DEFAULT_SORT.key ? undefined : s,
        // reset page if sort order changed
        p: s === computedSort.key ? page : undefined,
      }),
    [urls, bucket, filter, computedSort, page],
  )

  const makePageUrl = React.useCallback(
    (newP) =>
      urls.bucketPackageList(bucket, { filter, sort, p: newP !== 1 ? newP : undefined }),
    [urls, bucket, filter, sort],
  )

  // set filter query param on filter input change (debounced)
  React.useEffect(() => {
    if (filtering.value !== computedFilter) {
      history.push(
        urls.bucketPackageList(bucket, { filter: filtering.value || undefined, sort }),
      )
    }
  }, [history, urls, bucket, sort, filtering.value, computedFilter])

  // set sort query param to previously selected
  const sortPackagesBy = storage.load()?.sortPackagesBy
  React.useEffect(() => {
    if (sort || sort === sortPackagesBy) return
    switch (sortPackagesBy) {
      case 'modified':
      case 'name':
        history.replace(makeSortUrl(sortPackagesBy))
      // no default
    }
  }, [history, makeSortUrl, sort, sortPackagesBy])

  // scroll to top on page change
  usePrevious(computedPage, (prev) => {
    if (prev && computedPage !== prev && scrollRef.current) {
      scrollRef.current.scrollIntoView()
    }
  })

  const preferences = BucketPreferences.use()

  const createDialog = PD.usePackageCreationDialog({
    bucket,
    delayHashing: true,
    disableStateDisplay: true,
  })

  return (
    <>
      {createDialog.render({
        successTitle: 'Package created',
        successRenderMessage: ({ packageLink }) => (
          <>Package {packageLink} successfully created</>
        ),
        title: 'Create package',
      })}

      {totalCountQuery.case({
        fetching: () => (
          <M.Box pb={{ xs: 0, sm: 5 }} mx={{ xs: -2, sm: 0 }}>
            <M.Box mt={{ xs: 0, sm: 3 }} display="flex" justifyContent="space-between">
              <M.Box
                component={M.Paper}
                className={classes.paper}
                flexGrow={{ xs: 1, sm: 0 }}
                px={2}
                py={{ xs: 1.75, sm: 1.25 }}
              >
                <Skeleton
                  height={20}
                  width={{ xs: '100%', sm: 160 }}
                  borderRadius="borderRadius"
                />
              </M.Box>
              <M.Box
                component={M.Paper}
                className={classes.paper}
                px={2}
                py={{ xs: 1.75, sm: 1.25 }}
              >
                <Skeleton
                  height={20}
                  width={{ xs: 24, sm: 120 }}
                  borderRadius="borderRadius"
                />
              </M.Box>
            </M.Box>
            {R.range(0, 10).map((i) => (
              <PackageSkel key={i} />
            ))}
          </M.Box>
        ),
        error: displayError(),
        data: (totalCountData) => {
          if (!totalCountData.packages?.total) {
            return (
              <M.Box pt={5} textAlign="center">
                <M.Typography variant="h4">No packages</M.Typography>
                <M.Box pt={3} />
                {preferences?.ui?.actions?.createPackage && (
                  <>
                    <M.Button
                      variant="contained"
                      color="primary"
                      onClick={createDialog.open}
                    >
                      Create package
                    </M.Button>
                    <M.Box pt={2} />
                    <M.Typography>
                      Or{' '}
                      <StyledLink href={EXAMPLE_PACKAGE_URL} target="_blank">
                        push a package
                      </StyledLink>{' '}
                      with the Quilt Python API.
                    </M.Typography>
                  </>
                )}
              </M.Box>
            )
          }

          return (
            <M.Box pb={{ xs: 0, sm: 5 }} mx={{ xs: -2, sm: 0 }}>
              <M.Box position="relative" top={-80} ref={scrollRef} />
              <M.Box display="flex" mt={{ xs: 0, sm: 3 }}>
                <M.Box
                  component={M.Paper}
                  className={classes.paper}
                  flexGrow={{ xs: 1, sm: 0 }}
                  position="relative"
                >
                  <M.InputBase
                    {...filtering.input}
                    placeholder="Filter packages"
                    classes={{ input: classes.input }}
                    fullWidth
                    startAdornment={
                      <M.Icon className={classes.searchIcon}>search</M.Icon>
                    }
                    endAdornment={
                      <M.Fade in={!!filtering.input.value}>
                        <M.IconButton
                          className={classes.clear}
                          onClick={() => filtering.set('')}
                        >
                          <M.Icon>clear</M.Icon>
                        </M.IconButton>
                      </M.Fade>
                    }
                  />
                </M.Box>
                <M.Box flexGrow={1} display={{ xs: 'none', sm: 'block' }} />
                {preferences?.ui?.actions?.createPackage && (
                  <M.Box display={{ xs: 'none', sm: 'block' }} pr={1}>
                    <M.Button
                      variant="contained"
                      size="large"
                      color="primary"
                      style={{ paddingTop: 7, paddingBottom: 7 }}
                      onClick={createDialog.open}
                    >
                      Create package
                    </M.Button>
                  </M.Box>
                )}
                <M.Box component={M.Paper} className={classes.paper}>
                  <SortDropdown
                    value={computedSort.key}
                    options={SORT_OPTIONS}
                    makeSortUrl={makeSortUrl}
                  />
                </M.Box>
              </M.Box>

              {filteredCountQuery.case({
                fetching: () => R.range(0, 10).map((i) => <PackageSkel key={i} />),
                error: displayError(),
                data: (filteredCountData) => {
                  const filteredCount = filteredCountData.packages?.total
                  if (!filteredCount) {
                    return (
                      <M.Box
                        borderTop={{ xs: 1, sm: 0 }}
                        borderColor="divider"
                        pt={3}
                        px={{ xs: 2, sm: 0 }}
                      >
                        <M.Typography variant="h5">
                          No matching packages found
                        </M.Typography>
                      </M.Box>
                    )
                  }

                  const pages = Math.ceil(filteredCount / PER_PAGE)

                  if (computedPage > pages) {
                    return <RRDom.Redirect to={makePageUrl(pages)} />
                  }

                  return (
                    <>
                      {packagesQuery.case({
                        fetching: () => {
                          const items =
                            computedPage < pages ? PER_PAGE : filteredCount % PER_PAGE
                          return R.range(0, items).map((i) => <PackageSkel key={i} />)
                        },
                        error: displayError(),
                        data: (packagesData) =>
                          (packagesData.packages?.page || []).map((pkg) => (
                            <Package key={pkg.name} {...pkg} />
                          )),
                      })}
                      {pages > 1 && (
                        <Pagination {...{ pages, page: computedPage, makePageUrl }} />
                      )}
                    </>
                  )
                },
              })}
            </M.Box>
          )
        },
      })}
    </>
  )
}

export default function PackageListWrapper({
  match: {
    params: { bucket },
  },
  location,
}: RRDom.RouteComponentProps<{ bucket: string }>) {
  const { sort, filter, p } = parseSearch(location.search, true)
  const page = p ? parseInt(p, 10) : undefined
  return (
    <>
      <MetaTitle>{['Packages', bucket]}</MetaTitle>
      <WithPackagesSupport bucket={bucket}>
        <PackageList {...{ bucket, sort, filter, page }} />
      </WithPackagesSupport>
    </>
  )
}

/* TODO: optimize LinkedData fetching
{!!bucketCfg &&
  (packages && []).map(({ name }) => (
    <Data.Fetcher
      key={name}
      fetch={requests.getRevisionData}
      params={{ s3, sign, endpoint, bucket, name, id: 'latest', maxKeys: 0 }}
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
*/
