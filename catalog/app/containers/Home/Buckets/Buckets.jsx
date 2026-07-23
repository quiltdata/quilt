import * as R from 'ramda'
import * as React from 'react'
import { Link, useHistory, useLocation } from 'react-router-dom'
import * as M from '@material-ui/core'
import { fade } from '@material-ui/core/styles'
import * as Icons from '@material-ui/icons'
import * as Lab from '@material-ui/lab'

import Pagination from 'components/Pagination2'
import { useRelevantBuckets } from 'utils/Buckets'
import * as GQL from 'utils/GraphQL'
import * as NamedRoutes from 'utils/NamedRoutes'
import parseSearch from 'utils/parseSearch'
import useDebouncedInput from 'utils/useDebouncedInput'
import usePrevious from 'utils/usePrevious'

import BucketGrid from 'containers/Home/BucketGrid'
import BucketList from 'containers/Home/BucketGrid/BucketList'

import IS_ADMIN_QUERY from 'website/pages/Landing/gql/IsAdmin.generated'

const PER_PAGE = 15

function useIsAdmin() {
  const data = GQL.useQuery(IS_ADMIN_QUERY)
  return GQL.fold(data, {
    // 'me' is null when signed out (this landing is reachable anonymously in
    // OPEN mode) — treat that as "not an admin" rather than crashing.
    data: ({ me }) => !!me?.isAdmin,
    fetching: R.F,
    error: R.F,
  })
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
    // Let the view toggle (and tag shortcuts) wrap below the filter input
    // at narrow widths instead of overflowing and clipping the toggle labels.
    flexWrap: 'wrap',
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
  viewToggle: {
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
  const { urls } = NamedRoutes.use()
  const history = useHistory()
  const [page, setPage] = React.useState(1)
  const scrollRef = React.useRef(null)

  const location = useLocation()
  // 'view' rides beside 'q': absent = 'list' (dense rows), 'card' switches to a grid.
  const { q: filter = '', view: viewMode = 'list' } = parseSearch(location.search)
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
    const anyFieldMatches = R.pipe(R.filter(Boolean), R.map(R.toLower), R.any(matches))
    return buckets.filter((b) =>
      anyFieldMatches([b.title, b.name, b.description, ...(b.tags || [])]),
    )
  }, [terms, buckets])

  const pages = Math.ceil(filtered.length / PER_PAGE)

  const paginated = React.useMemo(
    () =>
      pages <= 1 ? filtered : filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE),
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
      history.push({
        search: NamedRoutes.mkSearch({
          q: filtering.value || undefined,
          view: viewMode === 'list' ? undefined : viewMode,
        }),
      })
    }
  }, [history, filtering.value, filter, viewMode])

  const clearFilter = React.useCallback(() => {
    filtering.set()
  }, [filtering])

  const changeView = React.useCallback(
    (_e, value) => {
      // exclusive ToggleButtonGroup emits null when the active button is clicked again
      if (!value) return
      history.push({
        search: NamedRoutes.mkSearch({
          q: filter || undefined,
          view: value === 'list' ? undefined : value,
        }),
      })
    },
    [history, filter],
  )

  const isAdmin = useIsAdmin()

  // The in-list 'Add a bucket' row; the standalone button below is hidden
  // whenever it shows so the two add affordances don't both appear.
  const showAddLink = !filter && buckets.length <= PER_PAGE - 1 && isAdmin

  return (
    <M.Container maxWidth={false} disableGutters className={classes.container}>
      <div className={classes.wrapper} ref={scrollRef}>
        <M.Typography variant="h3" color="textPrimary">
          Explore your buckets
        </M.Typography>
        <div className={classes.filterRow}>
          <M.TextField
            className={classes.filter}
            placeholder="Filter buckets"
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
            className={classes.viewToggle}
            value={viewMode}
            exclusive
            size="small"
            onChange={changeView}
          >
            <Lab.ToggleButton value="card">
              <Icons.GridOn />
            </Lab.ToggleButton>
            <Lab.ToggleButton value="list">
              <Icons.List />
            </Lab.ToggleButton>
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
        {filtered.length || !filter ? (
          viewMode === 'card' ? (
            <BucketGrid
              buckets={paginated}
              onTagClick={filtering.set}
              tagIsMatching={tagIsMatching}
              showAddLink={showAddLink}
            />
          ) : (
            <BucketList
              buckets={paginated}
              onTagClick={filtering.set}
              tagIsMatching={tagIsMatching}
              showAddLink={showAddLink}
            />
          )
        ) : (
          <M.Typography color="textPrimary" variant="h4">
            No buckets matching <b>&quot;{filter}&quot;</b>
          </M.Typography>
        )}
        <div className={classes.controls}>
          <M.Box>
            {buckets.length > 2 && isAdmin && !showAddLink && (
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
