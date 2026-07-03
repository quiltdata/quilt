import * as R from 'ramda'
import * as React from 'react'
import { Link, useHistory, useLocation } from 'react-router-dom'
import * as M from '@material-ui/core'
import { fade } from '@material-ui/core/styles'

import Pagination from 'components/Pagination2'
import { useRelevantBuckets } from 'utils/Buckets'
import * as GQL from 'utils/GraphQL'
import * as NamedRoutes from 'utils/NamedRoutes'
import parseSearch from 'utils/parseSearch'
import useDebouncedInput from 'utils/useDebouncedInput'
import usePrevious from 'utils/usePrevious'

import BucketList from 'website/components/BucketGrid/BucketList'

import DATA_PRODUCTS_QUERY from '../gql/DataProducts.generated'
import IS_ADMIN_QUERY from '../gql/IsAdmin.generated'

const PER_PAGE = 15

function useIsAdmin() {
  const data = GQL.useQuery(IS_ADMIN_QUERY)
  return GQL.fold(data, {
    data: ({ me: { isAdmin } }) => isAdmin,
    fetching: R.F,
    error: R.F,
  })
}

// Data products the active role owns — rendered as cards on the volume grid.
function useDataProducts() {
  const data = GQL.useQuery(DATA_PRODUCTS_QUERY)
  return GQL.fold(data, {
    data: ({ dataProducts }) => dataProducts,
    fetching: () => [],
    error: () => [],
  })
}

const useDataProductStyles = M.makeStyles((t) => ({
  card: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
  },
  caption: {
    color: t.palette.text.hint,
    letterSpacing: 1,
  },
  title: {
    ...t.typography.h6,
    color: t.palette.tertiary.main,
  },
}))

function DataProductCard({ dp }) {
  const classes = useDataProductStyles()
  const { urls } = NamedRoutes.use()
  return (
    <M.Card className={classes.card} data-testid="data-product-card">
      <M.CardHeader
        disableTypography
        avatar={
          <Link aria-hidden="true" tabIndex={-1} to={urls.dataProduct(dp.id)}>
            <M.Avatar>
              <M.Icon>view_module</M.Icon>
            </M.Avatar>
          </Link>
        }
        title={
          <>
            <M.Typography variant="overline" className={classes.caption} display="block">
              Data product
            </M.Typography>
            <Link className={classes.title} to={urls.dataProduct(dp.id)}>
              {dp.name}
            </Link>
          </>
        }
      />
    </M.Card>
  )
}

const useStyles = M.makeStyles((t) => ({
  container: {
    paddingBottom: t.spacing(5),
    paddingTop: t.spacing(3),
  },
  wrapper: {
    display: 'flex',
    flexDirection: 'column',
    gap: t.spacing(3),
  },
  filterRow: {
    alignItems: 'center',
    display: 'flex',
    gap: t.spacing(2),
    [t.breakpoints.down('xs')]: {
      alignItems: 'flex-start',
      flexDirection: 'column',
    },
  },
  filter: {
    flexShrink: 0,
    marginBottom: 0,
    marginTop: 0,
    [t.breakpoints.up('sm')]: {
      maxWidth: 360,
    },
  },
  tags: {
    alignItems: 'center',
    display: 'flex',
    flexWrap: 'wrap',
    gap: t.spacing(1),
  },
  tagsLabel: {
    ...t.typography.body2,
    color: t.palette.text.secondary,
  },
  controls: {
    display: 'flex',
    justifyContent: 'space-between',
    [t.breakpoints.down('xs')]: {
      alignItems: 'center',
      flexDirection: 'column-reverse',
      flexWrap: 'wrap',
    },
  },
  pgBtn: {
    background: fade(t.palette.primary.main, 0),
    border: `1px solid ${t.palette.primary.main}`,
    color: t.palette.primary.main,
    '&:hover': {
      background: fade(t.palette.primary.main, t.palette.action.hoverOpacity),
    },
    '&:not(:last-child)': {
      borderRight: 'none',
    },
  },
  pgCurrent: {
    color: t.palette.primary.contrastText,
    background: t.palette.primary.main,
    '&:hover': {
      background: t.palette.primary.main,
    },
  },
}))

export default function Buckets() {
  const classes = useStyles()
  // XXX: consider using graphql directly
  const buckets = useRelevantBuckets()
  const { urls } = NamedRoutes.use()
  const history = useHistory()
  const [page, setPage] = React.useState(1)
  const scrollRef = React.useRef(null)

  const location = useLocation()
  const { q: filter = '' } = parseSearch(location.search)
  const terms = React.useMemo(
    () => filter.toLowerCase().split(/\s+/).filter(Boolean),
    [filter],
  )

  const tagIsMatching = React.useCallback((t) => filter.includes(t), [filter])

  const allTags = React.useMemo(
    () =>
      R.pipe(
        R.chain((b) => b.tags || []),
        R.uniq,
        R.sortBy(R.toLower),
      )(buckets),
    [buckets],
  )

  const filtered = React.useMemo(() => {
    if (!terms.length) return buckets
    const matches = R.allPass(R.map(R.includes, terms))
    return buckets.filter(
      R.pipe(
        (b) => [b.title, b.name, b.description, ...(b.tags || [])],
        R.filter(Boolean),
        R.map(R.toLower),
        R.any(matches),
      ),
    )
  }, [terms, buckets])

  const pages = Math.ceil(filtered.length / PER_PAGE)

  const paginated = React.useMemo(
    () =>
      pages === 1 ? filtered : filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE),
    [filtered, pages, page],
  )

  usePrevious(page, (prev) => {
    if (prev && page !== prev && scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  })

  usePrevious(filtered, (prev) => {
    if (prev && !R.equals(filtered, prev)) {
      setPage(1)
    }
  })

  const filtering = useDebouncedInput(filter, 500)

  React.useEffect(() => {
    // TODO: handle route change
    //       and implement BucketGrid tag as <Link />
    if (filtering.value !== filter) {
      history.push(urls.home({ q: filtering.value }))
    }
  }, [history, filtering.value, filter, urls])

  const clearFilter = React.useCallback(() => {
    filtering.set()
  }, [filtering])

  const isAdmin = useIsAdmin()
  const dataProducts = useDataProducts()

  return (
    <M.Container maxWidth={false} disableGutters className={classes.container}>
      <div className={classes.wrapper} ref={scrollRef}>
        <M.Typography variant="h3" color="textPrimary">
          Explore your volumes
        </M.Typography>
        <div className={classes.filterRow}>
          <M.TextField
            className={classes.filter}
            placeholder="Find a bucket"
            variant="outlined"
            margin="dense"
            fullWidth
            InputProps={{
              startAdornment: (
                <M.InputAdornment position="start">
                  <M.Icon>search</M.Icon>
                </M.InputAdornment>
              ),
              endAdornment: filter ? (
                <M.InputAdornment position="end">
                  <M.IconButton edge="end" onClick={clearFilter}>
                    <M.Icon>clear</M.Icon>
                  </M.IconButton>
                </M.InputAdornment>
              ) : undefined,
            }}
            {...filtering.input}
          />
          {!!allTags.length && (
            <div className={classes.tags}>
              <span className={classes.tagsLabel}>or use shortcuts:</span>
              {allTags.map((t) => (
                <M.Chip
                  key={t}
                  label={t}
                  size="small"
                  clickable
                  color={tagIsMatching(t) ? 'primary' : 'default'}
                  onClick={() => filtering.set(t)}
                />
              ))}
            </div>
          )}
        </div>
        {dataProducts.length > 0 && (
          <M.Box mb={2}>
            <M.Typography variant="h4" color="textPrimary" gutterBottom>
              Data products
            </M.Typography>
            <M.Grid container spacing={4}>
              {dataProducts.map((dp) => (
                <M.Grid item xs={12} sm={6} md={4} lg={3} key={dp.id}>
                  <DataProductCard dp={dp} />
                </M.Grid>
              ))}
            </M.Grid>
          </M.Box>
        )}
        {paginated.length || !filter ? (
          <BucketList
            buckets={paginated}
            onTagClick={filtering.set}
            tagIsMatching={tagIsMatching}
            showAddLink={!filter && buckets.length <= PER_PAGE - 1 && isAdmin}
          />
        ) : (
          <M.Typography color="textPrimary" variant="h4">
            No buckets matching <b>&quot;{filter}&quot;</b>
          </M.Typography>
        )}
        <div className={classes.controls}>
          <M.Box>
            {buckets.length > 2 && isAdmin && (
              <M.Button
                variant="contained"
                color="primary"
                component={Link}
                to={urls.adminBuckets({ add: true })}
              >
                Add Bucket
              </M.Button>
            )}
          </M.Box>
          {pages > 1 && (
            <Pagination
              {...{ pages, page, onChange: setPage }}
              mt={0}
              mb={0}
              classes={{ button: classes.pgBtn, current: classes.pgCurrent }}
            />
          )}
        </div>
      </div>
    </M.Container>
  )
}
