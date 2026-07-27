import cx from 'classnames'
import * as R from 'ramda'
import * as React from 'react'
import { Link, useHistory, useLocation } from 'react-router-dom'
import * as M from '@material-ui/core'
import { fade } from '@material-ui/core/styles'
import * as Icons from '@material-ui/icons'
import * as Lab from '@material-ui/lab'

import Pagination from 'components/Pagination2'
import SelectDropdown from 'components/SelectDropdown'
import { useRelevantBuckets } from 'utils/Buckets'
import * as GQL from 'utils/GraphQL'
import * as NamedRoutes from 'utils/NamedRoutes'
import parseSearch from 'utils/parseSearch'
import useDebouncedInput from 'utils/useDebouncedInput'
import usePrevious from 'utils/usePrevious'

import BucketList, { useGridStyles } from 'containers/Home/BucketGrid/BucketList'

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

// Order mirrors the visible Menu; 'relevance' is the default and rides with
// no `sort` param so old links keep working.
// SelectDropdown's option shape (the same control /search's Sort uses, so the
// two sort affordances read and behave identically).
const SORT_OPTIONS = [
  { toString: () => 'Relevance', valueOf: () => 'relevance' },
  { toString: () => 'Name A–Z', valueOf: () => 'name-asc' },
  { toString: () => 'Name Z–A', valueOf: () => 'name-desc' },
]
const DEFAULT_SORT = SORT_OPTIONS[0].valueOf()
const SORT_VALUES = SORT_OPTIONS.map((o) => o.valueOf())

// `buckets` is already relevance+name sorted (see useRelevantBuckets) and
// has the admin curation filter (relevanceScore >= 0) applied; this just
// re-orders that same list per the selected sort option.
function sortBuckets(buckets, sort) {
  switch (sort) {
    case 'name-asc':
      return R.sortBy(R.pipe(R.prop('title'), R.toLower), buckets)
    case 'name-desc':
      return R.reverse(R.sortBy(R.pipe(R.prop('title'), R.toLower), buckets))
    case 'relevance':
    default:
      return buckets
  }
}

// Mirrors containers/Search/Sort.tsx so the two sort buttons match exactly.
const useSortButtonStyles = M.makeStyles((t) => ({
  root: {
    background: t.palette.background.paper,
  },
}))

const useSortStyles = M.makeStyles((t) => ({
  value: {
    fontWeight: t.typography.fontWeightMedium,
    marginLeft: t.spacing(0.5),
  },
}))

const useStyles = M.makeStyles((t) => ({
  container: {
    paddingBottom: t.spacing(5),
    paddingTop: t.spacing(3),
  },
  wrapper: {
    display: 'flex',
    flexDirection: 'column',
    gap: t.spacing(3),
    // Full width: the grid tiles into whatever room the main pane gives it
    // (auto-fill drops 4-up wide, 2-up mid, 1-up narrow), so there is no dead
    // canvas to the right of the content.
  },
  filterRow: {
    alignItems: 'center',
    display: 'flex',
    // Filter field, tag shortcuts, and sort control are flex children of
    // this one row; flex-wrap drops whichever doesn't fit to the next line
    // instead of overflowing.
    flexWrap: 'wrap',
    gap: t.spacing(2),
    [t.breakpoints.down('xs')]: {
      alignItems: 'flex-start',
      flexDirection: 'column',
    },
  },
  // One input vocabulary with the top-bar search band (components/Layout/
  // ContentBar): white ground, a 0.38 resting outline, a 24px leading glyph
  // that warms to 0.54 while the field has focus, and the 14px body step.
  filterInput: {
    background: t.palette.common.white,
    fontSize: t.typography.body2.fontSize,
    '& $filterOutline': {
      borderColor: fade(t.palette.common.black, 0.38),
    },
    '&:focus-within $filterIcon': {
      color: t.palette.text.secondary,
    },
  },
  filterOutline: {},
  filterIcon: {
    color: fade(t.palette.common.black, 0.38),
    transition: t.transitions.create('color', { duration: 150 }),
  },
  filter: {
    flexShrink: 0,
    marginBottom: 0,
    marginTop: 0,
    [t.breakpoints.up('sm')]: {
      maxWidth: 360,
    },
  },
  sort: {
    flexShrink: 0,
    marginBottom: 0,
    // Hugs the right edge of the filter row when there's room to.
    marginLeft: 'auto',
    marginTop: 0,
    minWidth: 200,
    [t.breakpoints.down('xs')]: {
      marginLeft: 0,
      width: '100%',
    },
  },
  // Sits beside the filter field (a flex child of `filterRow`, not a row of
  // its own); flex-wrap on the parent drops it below only when it doesn't
  // fit, and its own wrap handles a long tag list once it's there.
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
  // Mirrors BucketCard's tag-chip focus ring (see that file's comment on why
  // `.Mui-focusVisible` is the stable global hook here).
  tagChip: {
    '&.Mui-focusVisible': {
      outline: `2px solid ${t.palette.primary.main}`,
      outlineOffset: -2,
    },
  },
  // Mirrors BucketCard's `matching` treatment: the Indicator Rule's amber
  // (wash + border), never a solid fill, so the shortcuts and the in-card
  // tags share one selection vocabulary.
  tagChipMatching: {
    backgroundColor: fade(t.palette.secondary.main, 0.15),
    border: `1px solid ${t.palette.secondary.main}`,
    color: t.palette.text.primary,
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
  // Border-first per DESIGN.md's Overlay-Only Rule, matching the card grid
  // that these states substitute for (no resting shadow).
  empty: {
    border: `1px solid ${t.palette.divider}`,
    borderRadius: t.shape.borderRadius,
    padding: t.spacing(4, 3),
    textAlign: 'center',
  },
  emptyLine: {
    marginTop: t.spacing(1),
  },
  // A skeleton CARD silhouette (not a row, not a spinner) so the loading
  // state previews the grid it's about to become.
  skeletonCard: {
    border: `1px solid ${t.palette.divider}`,
    borderRadius: t.shape.borderRadius,
    display: 'flex',
    flexDirection: 'column',
    gap: t.spacing(1),
    padding: t.spacing(2),
  },
  skeletonHeader: {
    alignItems: 'center',
    display: 'flex',
    gap: t.spacing(1.5),
  },
  skeletonHeaderText: {
    flexGrow: 1,
  },
  skeletonTags: {
    display: 'flex',
    gap: t.spacing(0.5),
    marginTop: t.spacing(0.5),
  },
  skeletonTag: {
    borderRadius: 16, // the chip token (DESIGN.md components.chip.rounded)
  },
  // Universal reduced-motion escape hatch: kills any animation on the
  // skeleton (Lab.Skeleton's pulse included) without reaching for its
  // hashed dev class name, which JSS can't target directly.
  skeletonGrid: {
    '@media (prefers-reduced-motion: reduce)': {
      '& *': {
        animationDuration: '0.01ms !important',
        animationIterationCount: '1 !important',
      },
    },
  },
}))

function CardSkeleton({ classes }) {
  return (
    <div className={classes.skeletonCard}>
      <div className={classes.skeletonHeader}>
        <Lab.Skeleton variant="circle" width={44} height={44} />
        <div className={classes.skeletonHeaderText}>
          <Lab.Skeleton variant="text" width="70%" height={24} />
        </div>
      </div>
      <Lab.Skeleton variant="text" width="45%" height={16} />
      <Lab.Skeleton variant="text" width="95%" height={14} />
      <Lab.Skeleton variant="text" width="80%" height={14} />
      <div className={classes.skeletonTags}>
        <Lab.Skeleton
          className={classes.skeletonTag}
          variant="rect"
          width={52}
          height={24}
        />
        <Lab.Skeleton
          className={classes.skeletonTag}
          variant="rect"
          width={68}
          height={24}
        />
      </div>
    </div>
  )
}

// `useRelevantBuckets` always suspends (it wraps a suspense-enabled GraphQL
// query with no non-suspending escape hatch), so this is the mount point a
// real loading state can reach: the Suspense fallback below BucketsBody.
// Six cards is a plausible first paint at any grid width (1-, 2-, or 3-up).
function BucketsSkeleton() {
  const classes = useStyles()
  const gridClasses = useGridStyles()
  return (
    <div className={cx(gridClasses.grid, classes.skeletonGrid)}>
      {R.range(0, 6).map((i) => (
        <CardSkeleton key={i} classes={classes} />
      ))}
    </div>
  )
}

function ZeroState({ isAdmin }) {
  const classes = useStyles()
  return (
    <M.Paper elevation={0} className={classes.empty}>
      <M.Typography color="textPrimary" variant="body1">
        No buckets yet
      </M.Typography>
      <M.Typography className={classes.emptyLine} color="textSecondary" variant="body2">
        {isAdmin
          ? 'Add a bucket to make it searchable and browsable here.'
          : "Your workspace admin hasn't connected one yet."}
      </M.Typography>
    </M.Paper>
  )
}

function NoMatch({ filter }) {
  const classes = useStyles()
  return (
    <M.Paper elevation={0} className={classes.empty}>
      <M.Typography color="textPrimary" variant="body1">
        No buckets matching <b>&quot;{filter}&quot;</b>
      </M.Typography>
    </M.Paper>
  )
}

// The tag-shortcut chips, lifted out of BucketsBody so they can render as a
// flex child of `filterRow` — beside the filter field — instead of as a
// block below the whole grid. Still needs bucket data (to know which tags
// exist), so it still suspends; it just does so in its own boundary, right
// next to the filter/sort fields that deliberately stay outside any
// suspense boundary so they're usable while the grid loads.
function TagShortcuts({ filter, onTagClick }) {
  const classes = useStyles()
  const buckets = useRelevantBuckets()

  const tagIsMatching = React.useCallback((tg) => filter.includes(tg), [filter])

  const allTags = React.useMemo(
    () =>
      R.pipe(
        R.chain((b) => b.tags || []),
        R.uniq,
        R.sortBy(R.toLower),
      )(buckets),
    [buckets],
  )

  if (!buckets.length || !allTags.length) return null

  return (
    <div className={classes.tags}>
      {allTags.map((tg) => (
        <M.Chip
          key={tg}
          className={cx(classes.tagChip, {
            [classes.tagChipMatching]: tagIsMatching(tg),
          })}
          label={tg}
          size="small"
          clickable
          color="default"
          onClick={() => onTagClick(tg)}
        />
      ))}
    </div>
  )
}

// Everything that needs bucket data lives below this line, inside the
// Suspense boundary — filter text and sort order (owned by the parent) don't.
function BucketsBody({ filter, sort, isAdmin, onTagClick, scrollRef }) {
  const classes = useStyles()
  const { urls } = NamedRoutes.use()
  const buckets = useRelevantBuckets()
  const [page, setPage] = React.useState(1)

  const terms = React.useMemo(
    () => filter.toLowerCase().split(/\s+/).filter(Boolean),
    [filter],
  )

  // Same one-liner as TagShortcuts (both derive it from `filter`, not from
  // bucket data) — kept local so each component's dependency is obvious.
  const tagIsMatching = React.useCallback((tg) => filter.includes(tg), [filter])

  const filtered = React.useMemo(() => {
    if (!terms.length) return buckets
    const matches = R.allPass(R.map(R.includes, terms))
    const anyFieldMatches = R.pipe(R.filter(Boolean), R.map(R.toLower), R.any(matches))
    return buckets.filter((b) =>
      anyFieldMatches([b.title, b.name, b.description, ...(b.tags || [])]),
    )
  }, [terms, buckets])

  const sorted = React.useMemo(() => sortBuckets(filtered, sort), [filtered, sort])

  const pages = Math.ceil(sorted.length / PER_PAGE)

  const paginated = React.useMemo(
    () => (pages <= 1 ? sorted : sorted.slice((page - 1) * PER_PAGE, page * PER_PAGE)),
    [sorted, pages, page],
  )

  usePrevious(page, (prev) => {
    if (prev && page !== prev && scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  })

  usePrevious(sorted, (prev) => {
    if (prev && !R.equals(sorted, prev)) {
      setPage(1)
    }
  })

  const noBuckets = !buckets.length
  const noMatch = !noBuckets && !sorted.length

  return (
    <>
      {noBuckets ? (
        <ZeroState isAdmin={isAdmin} />
      ) : noMatch ? (
        <NoMatch filter={filter} />
      ) : (
        <BucketList
          buckets={paginated}
          tagIsMatching={tagIsMatching}
          onTagClick={onTagClick}
        />
      )}
      <div className={classes.controls}>
        <M.Box>
          {isAdmin && (
            <M.Button
              variant="outlined"
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
            // Pagination2 defaults to a *contained* ButtonGroup, which carries
            // a resting shadow (Overlay-Only violation) and reads heavier than
            // anything else on the page; outlined + flat matches the Add-bucket
            // button and the card borders.
            buttonGroupProps={{ variant: 'outlined', disableElevation: true }}
          />
        )}
      </div>
    </>
  )
}

export default function Buckets() {
  const classes = useStyles()
  const history = useHistory()
  const location = useLocation()
  const scrollRef = React.useRef(null)

  const { q: filter = '', sort: sortParam } = parseSearch(location.search, true)
  const sort = SORT_VALUES.includes(sortParam) ? sortParam : DEFAULT_SORT

  const filtering = useDebouncedInput(filter, 500)

  React.useEffect(() => {
    if (filtering.value !== filter) {
      history.push({
        search: NamedRoutes.mkSearch({
          q: filtering.value || undefined,
          sort: sort === DEFAULT_SORT ? undefined : sort,
        }),
      })
    }
  }, [history, filtering.value, filter, sort])

  const clearFilter = React.useCallback(() => {
    filtering.set()
  }, [filtering])

  const sortButtonClasses = useSortButtonStyles()
  const sortClasses = useSortStyles()

  const sortValue = React.useMemo(
    () => SORT_OPTIONS.find((o) => o.valueOf() === sort) || SORT_OPTIONS[0],
    [sort],
  )

  const changeSort = React.useCallback(
    (selected) => {
      const value = selected.valueOf()
      history.push({
        search: NamedRoutes.mkSearch({
          q: filter || undefined,
          sort: value === DEFAULT_SORT ? undefined : value,
        }),
      })
    },
    [history, filter],
  )

  const isAdmin = useIsAdmin()

  return (
    <M.Container maxWidth={false} disableGutters className={classes.container}>
      <div className={classes.wrapper} ref={scrollRef}>
        <div className={classes.filterRow}>
          <M.TextField
            className={classes.filter}
            placeholder="Filter buckets"
            variant="outlined"
            margin="dense"
            fullWidth
            InputProps={{
              className: classes.filterInput,
              classes: { notchedOutline: classes.filterOutline },
              startAdornment: (
                <M.InputAdornment position="start">
                  <Icons.FilterList className={classes.filterIcon} />
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
          <React.Suspense fallback={null}>
            <TagShortcuts filter={filter} onTagClick={filtering.set} />
          </React.Suspense>
          <SelectDropdown
            className={classes.sort}
            classes={sortClasses}
            options={SORT_OPTIONS}
            value={sortValue}
            onChange={changeSort}
            ButtonProps={{ classes: sortButtonClasses, size: 'medium' }}
          >
            Sort by:
          </SelectDropdown>
        </div>
        <React.Suspense fallback={<BucketsSkeleton />}>
          <BucketsBody
            filter={filter}
            sort={sort}
            isAdmin={isAdmin}
            onTagClick={filtering.set}
            scrollRef={scrollRef}
          />
        </React.Suspense>
      </div>
    </M.Container>
  )
}
