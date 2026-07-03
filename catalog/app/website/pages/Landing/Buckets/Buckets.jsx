import * as R from 'ramda'
import * as React from 'react'
import { Link, useHistory, useLocation } from 'react-router-dom'
import * as M from '@material-ui/core'
import { fade } from '@material-ui/core/styles'
import * as Lab from '@material-ui/lab'

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

// Data products the active role owns — merged into the volume list as rows,
// sorted among themselves alphabetically by their displayed label.
function useDataProducts() {
  const data = GQL.useQuery(DATA_PRODUCTS_QUERY)
  const dataProducts = GQL.fold(data, {
    data: (d) => d.dataProducts,
    fetching: () => [],
    error: () => [],
  })
  return React.useMemo(
    () =>
      R.sortBy(
        (dp) => (dp.title || dp.name).toLowerCase(),
        dataProducts.map((dp) => ({
          id: dp.id,
          name: dp.name,
          title: dp.title,
          description: dp.description,
          objectCount: dp.definition.objects.length,
          packageCount: dp.definition.packages.length,
        })),
      ),
    [dataProducts],
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
  typeToggle: {
    flexShrink: 0,
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
  const dataProducts = useDataProducts()
  const { urls } = NamedRoutes.use()
  const history = useHistory()
  const [page, setPage] = React.useState(1)
  const scrollRef = React.useRef(null)

  const location = useLocation()
  // 'type' rides beside 'q': absent = 'all', 'buckets' | 'data-products' narrow the list.
  const { q: filter = '', type: typeFilter = 'all' } = parseSearch(location.search)
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

  // One combined list: data products first (fewer, curated), then buckets.
  // Kept as two arrays — DPs always precede buckets, so a page slice of the
  // concatenation is a DP run followed by a bucket run.
  const filtered = React.useMemo(() => {
    const matches = R.allPass(R.map(R.includes, terms))
    const anyFieldMatches = R.pipe(R.filter(Boolean), R.map(R.toLower), R.any(matches))
    const dps =
      typeFilter === 'buckets'
        ? []
        : dataProducts.filter(
            (dp) => !terms.length || anyFieldMatches([dp.title, dp.name, dp.description]),
          )
    const bs =
      typeFilter === 'data-products'
        ? []
        : buckets.filter(
            (b) =>
              !terms.length ||
              anyFieldMatches([b.title, b.name, b.description, ...(b.tags || [])]),
          )
    return { dps, buckets: bs, total: dps.length + bs.length }
  }, [terms, typeFilter, dataProducts, buckets])

  const pages = Math.ceil(filtered.total / PER_PAGE)

  const paginated = React.useMemo(() => {
    if (pages <= 1) return filtered
    const start = (page - 1) * PER_PAGE
    const end = page * PER_PAGE
    const dpTotal = filtered.dps.length
    return {
      dps: filtered.dps.slice(Math.min(start, dpTotal), Math.min(end, dpTotal)),
      buckets: filtered.buckets.slice(
        Math.max(0, start - dpTotal),
        Math.max(0, end - dpTotal),
      ),
    }
  }, [filtered, pages, page])

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
      history.push({
        search: NamedRoutes.mkSearch({
          q: filtering.value || undefined,
          type: typeFilter === 'all' ? undefined : typeFilter,
        }),
      })
    }
  }, [history, filtering.value, filter, typeFilter])

  const clearFilter = React.useCallback(() => {
    filtering.set()
  }, [filtering])

  const changeType = React.useCallback(
    (_e, value) => {
      // exclusive ToggleButtonGroup emits null when the active button is clicked again
      if (!value) return
      history.push({
        search: NamedRoutes.mkSearch({
          q: filter || undefined,
          type: value === 'all' ? undefined : value,
        }),
      })
    },
    [history, filter],
  )

  const isAdmin = useIsAdmin()

  return (
    <M.Container maxWidth={false} disableGutters className={classes.container}>
      <div className={classes.wrapper} ref={scrollRef}>
        <M.Typography variant="h3" color="textPrimary">
          Explore your volumes
        </M.Typography>
        <div className={classes.filterRow}>
          <M.TextField
            className={classes.filter}
            placeholder="Filter volumes"
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
          <Lab.ToggleButtonGroup
            className={classes.typeToggle}
            value={typeFilter}
            exclusive
            size="small"
            onChange={changeType}
          >
            <Lab.ToggleButton value="all">All</Lab.ToggleButton>
            <Lab.ToggleButton value="buckets">Volumes</Lab.ToggleButton>
            <Lab.ToggleButton value="data-products">Data products</Lab.ToggleButton>
          </Lab.ToggleButtonGroup>
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
        {filtered.total || !filter ? (
          <BucketList
            buckets={paginated.buckets}
            dataProducts={paginated.dps}
            onTagClick={filtering.set}
            tagIsMatching={tagIsMatching}
            showAddLink={!filter && buckets.length <= PER_PAGE - 1 && isAdmin}
          />
        ) : (
          <M.Typography color="textPrimary" variant="h4">
            No volumes matching <b>&quot;{filter}&quot;</b>
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
