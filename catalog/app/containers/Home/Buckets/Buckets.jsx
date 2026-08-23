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
import { docs } from 'constants/urls'
import { useRelevantBuckets } from 'utils/Buckets'
import * as GQL from 'utils/GraphQL'
import * as NamedRoutes from 'utils/NamedRoutes'
import parseSearch from 'utils/parseSearch'
import useDebouncedInput from 'utils/useDebouncedInput'
import usePrevious from 'utils/usePrevious'

import * as DP from 'model/DataProducts'
import { useFeature } from 'utils/features'

import BucketList, { useGridStyles } from 'containers/Home/BucketGrid/BucketList'
import BucketRows from 'containers/Home/BucketGrid/BucketRows'

import IS_ADMIN_QUERY from 'website/pages/Landing/gql/IsAdmin.generated'

const PER_PAGE = 15

// `view` rides beside `q` and `sort` in the URL. Absent means the card grid,
// so an existing link keeps landing on the view it always did; `list` is the
// dense-rows alternative.
const VIEW_CARDS = 'cards'
const VIEW_LIST = 'list'

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

// A volume is a bucket or a data product. They share this list, this filter,
// this sort, and this pagination — a reader is browsing "what is here", and
// which backing kind an entry has is a property of the entry, not a reason to
// put it in a different pane.
//
// The wrapper exists because the two carry different fields: a bucket sorts by
// `title` and has a `relevanceScore`, a product has `name` and neither. Rather
// than teach every comparator about both shapes, each entry is normalized once
// to the two keys the list actually orders on.
const asEntries = (buckets, products) => [
  ...buckets.map((b) => ({
    kind: 'bucket',
    // Buckets always have a title; `name` is the s3 name and is the fallback a
    // bucket card itself uses.
    label: b.title || b.name,
    relevance: b.relevanceScore ?? 0,
    bucket: b,
  })),
  ...products.map((p) => ({
    kind: 'product',
    label: p.name,
    // No platform exposes anything relevance-like for a product, and inventing
    // a score would silently decide ranking. 0 places them among buckets of
    // default relevance rather than pinning them to either end.
    relevance: 0,
    product: p,
  })),
]

// `buckets` arrives relevance+name sorted with the admin curation filter
// (relevanceScore >= 0) applied; products have no such ordering of their own, so
// relevance mode re-sorts the merged list rather than trusting arrival order.
function sortEntries(entries, sort) {
  const byLabel = R.pipe(R.prop('label'), R.toLower)
  switch (sort) {
    case 'name-asc':
      return R.sortBy(byLabel, entries)
    case 'name-desc':
      return R.reverse(R.sortBy(byLabel, entries))
    case 'relevance':
    default:
      // Descending relevance, then label — the same rule `useRelevantBuckets`
      // applies to buckets alone, extended over the merged list so a product
      // does not jump the queue for lacking a score.
      return R.sortWith([R.descend(R.prop('relevance')), R.ascend(byLabel)], entries)
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

// Same fix /search applies to its results-view toggle: MUI v4's Lab
// ToggleButton doesn't inherit the outlined-button border colour, so it reads
// lighter than the filter field and sort control it sits beside.
const useViewToggleButtonStyles = M.makeStyles({
  root: {
    borderColor: `rgba(0, 0, 0, 0.23)`,
    padding: '5px',
  },
})

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
  // Closes the filter row on the right, after the sort control (which carries
  // the `margin-left: auto` that pushes the pair over).
  viewToggle: {
    flexShrink: 0,
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
  // The recovery row under an empty state: droppable filter terms, then the
  // clear-all. Centered to match the state's own `textAlign`, and wrapping
  // rather than scrolling because a filter can hold more terms than fit.
  emptyActions: {
    alignItems: 'center',
    display: 'flex',
    flexWrap: 'wrap',
    gap: t.spacing(1),
    justifyContent: 'center',
    marginTop: t.spacing(3),
  },
  // Same focus-ring hook the card's tags use: ButtonBase (Chip's root when
  // `clickable`) always stamps the global `Mui-focusVisible` alongside its own
  // hashed class, so this is stable without reaching for `.MuiChip-*`.
  emptyTerm: {
    '&.Mui-focusVisible': {
      outline: `2px solid ${t.palette.primary.main}`,
      outlineOffset: -2,
    },
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
  // The list-view placeholder: one outlined block of rows, matching the
  // Paper + divided List that BucketRows resolves into.
  skeletonRows: {
    border: `1px solid ${t.palette.divider}`,
    borderRadius: t.shape.borderRadius,
  },
  skeletonRow: {
    alignItems: 'center',
    display: 'flex',
    gap: t.spacing(2),
    padding: t.spacing(1.5, 2),
    '& + &': {
      borderTop: `1px solid ${t.palette.divider}`,
    },
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

function RowSkeleton({ classes }) {
  return (
    <div className={classes.skeletonRow}>
      <Lab.Skeleton variant="circle" width={32} height={32} />
      <Lab.Skeleton variant="text" width="30%" height={20} />
      <Lab.Skeleton variant="text" width="45%" height={16} />
    </div>
  )
}

// `useRelevantBuckets` always suspends (it wraps a suspense-enabled GraphQL
// query with no non-suspending escape hatch), so this is the mount point a
// real loading state can reach: the Suspense fallback below BucketsBody.
// Six placeholders is a plausible first paint at any grid width (1-, 2-, or
// 3-up) and a reasonable first screen of rows; each view gets the shape it
// will actually resolve into, so nothing changes silhouette on load.
function BucketsSkeleton({ view }) {
  const classes = useStyles()
  const gridClasses = useGridStyles()
  const cards = view !== VIEW_LIST
  return (
    <div
      className={cx(
        cards ? gridClasses.grid : classes.skeletonRows,
        classes.skeletonGrid,
      )}
    >
      {R.range(0, 6).map((i) =>
        cards ? (
          <CardSkeleton key={i} classes={classes} />
        ) : (
          <RowSkeleton key={i} classes={classes} />
        ),
      )}
    </div>
  )
}

// First run: the teaching and the doing in one place.
//
// This told admins to "add a volume" while the button that does it sat in a
// separate controls row *below* the grid -- the two halves of one instruction,
// separated by the empty space they were describing. At zero volumes that row
// holds nothing else (pagination needs more than one page), so the action moves
// up here and the row withholds its own; there is never a second Add button.
//
// Bucket-specific copy is safe here even though a volume can also be a data
// product. `isEmpty` is `!entries.length` -- zero buckets *and* zero products --
// so a catalog whose products are its only content never reaches this state, and
// an empty workspace genuinely has a bucket-shaped next step. (Connecting an
// external catalog is the other path, and lives in Admin > Settings; it is left
// out deliberately rather than overlooked, to keep one action on one state.)
//
// Non-admins get a real next step instead of a closed door. They cannot connect
// anything, so the honest end of that sentence is who can -- plus the docs, for
// what a volume is before they go asking. No invented claims about their
// workspace.
function ZeroState({ isAdmin }) {
  const classes = useStyles()
  const { urls } = NamedRoutes.use()
  return (
    <M.Paper elevation={0} className={classes.empty}>
      <M.Typography color="textPrimary" variant="body1">
        No volumes yet
      </M.Typography>
      <M.Typography className={classes.emptyLine} color="textSecondary" variant="body2">
        {isAdmin
          ? 'Connect an S3 bucket and its packages become searchable and browsable here.'
          : 'Your workspace admin connects these. Ask them which bucket holds the data you need.'}
      </M.Typography>
      <div className={classes.emptyActions}>
        {isAdmin ? (
          <M.Button
            variant="outlined"
            color="primary"
            component={Link}
            to={urls.adminBuckets({ add: true })}
          >
            Add Bucket
          </M.Button>
        ) : (
          <M.Button
            size="small"
            color="primary"
            // A path already referenced elsewhere in the app, not an invented one.
            href={`${docs}/quilt-platform-administrator/technical-reference`}
            target="_blank"
            rel="noopener noreferrer"
          >
            What is a volume?
          </M.Button>
        )}
      </div>
    </M.Paper>
  )
}

// No filter match: a readout, not a wall.
//
// This used to be one line -- `No volumes matching "foo"` -- with no action on
// it. The only way out was noticing the small clear button up in the filter
// field, so the more terms someone had stacked, the more stuck they were.
//
// Three things instead, in the order a reader needs them: what happened, what
// was actually searched, and the controls that widen it. `total` is the exact
// number of volumes the filter ran against -- PRODUCT.md's "trust is rendered,
// not asserted" applied to an empty state: the instrument says how many volumes
// it looked at rather than implying there are none. It counts *entries*, so a
// data product is a volume here exactly as it is everywhere else on this screen.
//
// Each term is individually droppable because over-narrowing is usually one
// term's fault, and a reader can see which. Clearing everything stays available
// as the blunt instrument beside them. Both are the same controls the filter
// row owns; nothing new is invented here.
function NoMatch({ filter, terms, total, onDropTerm, onClear }) {
  const classes = useStyles()
  // Only worth offering per-term drops when there is a choice to make; with a
  // single term "drop it" and "clear the filter" are the same action, and two
  // buttons that do one thing is a worse state than one that does.
  const droppable = terms.length > 1 ? terms : []
  return (
    <M.Paper elevation={0} className={classes.empty}>
      <M.Typography color="textPrimary" variant="body1">
        No volumes matching <b>&quot;{filter}&quot;</b>
      </M.Typography>
      <M.Typography className={classes.emptyLine} color="textSecondary" variant="body2">
        {total === 1
          ? 'Searched the 1 volume you can reach, across name, description, and tags.'
          : `Searched all ${total} volumes you can reach, across name, description, and tags.`}
      </M.Typography>
      <div className={classes.emptyActions}>
        {droppable.map((tg) => (
          <M.Chip
            key={tg}
            className={classes.emptyTerm}
            label={`Without "${tg}"`}
            size="small"
            clickable
            color="default"
            onClick={() => onDropTerm(tg)}
          />
        ))}
        <M.Button size="small" color="primary" onClick={onClear}>
          Clear filter
        </M.Button>
      </div>
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
function BucketsBody({ filter, sort, view, isAdmin, onTagClick, onDropTerm, scrollRef }) {
  const classes = useStyles()
  const { urls } = NamedRoutes.use()
  const buckets = useRelevantBuckets()
  const [page, setPage] = React.useState(1)
  // Suspending read — safe here because this component already renders inside a
  // Suspense boundary (see the `BucketsSkeleton` fallback below).
  const dataProductsEnabled = useFeature('data-products')

  // Two splits of the same filter, deliberately.
  //
  // `terms` is lowercased because matching is case-insensitive. `rawTerms` keeps
  // what the reader actually typed, for showing back to them: a filter of
  // "Genomics RNA" must not be quoted back as "genomics" in the empty state, and
  // dropping a term has to rebuild the filter from the original casing or the
  // field would silently rewrite itself on every drop.
  const rawTerms = React.useMemo(() => filter.split(/\s+/).filter(Boolean), [filter])

  const terms = React.useMemo(() => rawTerms.map((s) => s.toLowerCase()), [rawTerms])

  // Same one-liner as TagShortcuts (both derive it from `filter`, not from
  // bucket data) — kept local so each component's dependency is obvious.
  const tagIsMatching = React.useCallback((tg) => filter.includes(tg), [filter])

  // Read through the adapter port, never `fixtures` directly. The flag is passed
  // in rather than guarding the call: hooks cannot be called conditionally, so
  // the disabled case resolves to [] inside the resource without reaching the
  // adapter at all.
  const dataProducts = DP.useProducts(dataProductsEnabled)

  // One list from here down. Merging *before* filter/sort/pagination is what
  // makes a volume a volume: a product is ranked against buckets, lands on
  // whichever page it sorts onto, and answers the same filter box. Merging after
  // (the previous shape) meant products trailed the buckets and only appeared on
  // the last page — two lists wearing one heading.
  const entries = React.useMemo(
    () => asEntries(buckets, dataProducts),
    [buckets, dataProducts],
  )

  const filtered = React.useMemo(() => {
    if (!terms.length) return entries
    const matches = R.allPass(R.map(R.includes, terms))
    const anyFieldMatches = R.pipe(R.filter(Boolean), R.map(R.toLower), R.any(matches))
    // Each kind contributes the fields it actually has. A product has labels
    // where a bucket has tags; neither borrows the other's vocabulary.
    return entries.filter((e) =>
      e.kind === 'bucket'
        ? anyFieldMatches([
            e.bucket.title,
            e.bucket.name,
            e.bucket.description,
            ...(e.bucket.tags || []),
          ])
        : anyFieldMatches([
            e.product.name,
            e.product.description,
            ...(e.product.labels || []),
          ]),
    )
  }, [terms, entries])

  // Dropping a term is owned by the parent (`onDropTerm`), because it has to read
  // the filter field's *pending* value rather than the URL.
  //
  // `rawTerms` here is derived from `filter`, which is the URL, which only catches
  // up after the field's 500ms debounce. Rebuilding from it meant two chips
  // clicked inside that window both computed from the same pre-click terms, so the
  // second overwrote the first and resurrected the term it had just removed.
  // Caught in review; there is a test for the two-drop sequence.

  // `''`, not a bare `set()`. `set` is a `useState` setter, so calling it with no
  // argument stores `undefined` and hands the TextField `value={undefined}` --
  // React stops controlling the input, which then keeps the text already in it,
  // so the box reads "alpha beta" while the filter clears underneath. Transient
  // (the URL round-trip repairs it a tick later), which is why it went unnoticed.
  // `clearFilter` in the parent is fixed the same way.
  const onClearFilter = React.useCallback(() => onTagClick(''), [onTagClick])

  const sorted = React.useMemo(() => sortEntries(filtered, sort), [filtered, sort])

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

  // Empty means nothing of either kind. ZeroState teaches "add a bucket", which
  // would be wrong on a catalog whose products are the only thing here.
  const isEmpty = !entries.length
  const noMatch = !isEmpty && !sorted.length

  // Both views take the same props over the same page: the toggle swaps the
  // renderer and nothing else.
  const View = view === VIEW_LIST ? BucketRows : BucketList

  return (
    <>
      {isEmpty ? (
        <ZeroState isAdmin={isAdmin} />
      ) : noMatch ? (
        <NoMatch
          filter={filter}
          terms={rawTerms}
          total={entries.length}
          onDropTerm={onDropTerm}
          onClear={onClearFilter}
        />
      ) : (
        <View entries={paginated} tagIsMatching={tagIsMatching} onTagClick={onTagClick} />
      )}
      <div className={classes.controls}>
        <M.Box>
          {/* Withheld at zero volumes, where `ZeroState` carries this same action
              inside the teaching copy that asks for it. Two Add buttons on one
              screen would be the same instruction twice. */}
          {isAdmin && !isEmpty && (
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

  const {
    q: filter = '',
    sort: sortParam,
    view: viewParam,
  } = parseSearch(location.search, true)
  const sort = SORT_VALUES.includes(sortParam) ? sortParam : DEFAULT_SORT
  const view = viewParam === VIEW_LIST ? VIEW_LIST : VIEW_CARDS

  // Every control pushes the whole query string, so each one has to carry the
  // other two forward or switching a view would silently drop the filter.
  const search = React.useCallback(
    (next) =>
      NamedRoutes.mkSearch({
        q: filter || undefined,
        sort: sort === DEFAULT_SORT ? undefined : sort,
        view: view === VIEW_CARDS ? undefined : view,
        ...next,
      }),
    [filter, sort, view],
  )

  const filtering = useDebouncedInput(filter, 500)

  // Drop one term from the filter, composing correctly when several are dropped in
  // quick succession.
  //
  // The functional updater is the whole point: `filtering.set` is a `useState`
  // setter, so this reads the *pending* field value. Computing from the
  // URL-derived filter instead meant two chips clicked inside the 500ms debounce
  // window both started from the same pre-click terms, and the second write
  // resurrected the term the first had removed.
  //
  // Splits on whitespace here rather than reusing the body's `rawTerms` for the
  // same reason -- `rawTerms` is a projection of the URL, and this needs the
  // field.
  const dropTerm = React.useCallback(
    (term) =>
      filtering.set((current) =>
        (current || '')
          .split(/\s+/)
          .filter(Boolean)
          .filter((t) => t !== term)
          .join(' '),
      ),
    [filtering],
  )

  React.useEffect(() => {
    if (filtering.value !== filter) {
      history.push({ search: search({ q: filtering.value || undefined }) })
    }
  }, [history, search, filtering.value, filter])

  const clearFilter = React.useCallback(() => {
    // `set('')`, not `set()`. `set` is a `useState` setter, so a bare call stores
    // `undefined`, which hands the TextField a `value` of `undefined` and makes
    // React stop controlling it -- the box then keeps the text already in it
    // while the filter clears underneath.
    filtering.set('')
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
        search: search({ sort: value === DEFAULT_SORT ? undefined : value }),
      })
    },
    [history, search],
  )

  const viewToggleButtonClasses = useViewToggleButtonStyles()

  const changeView = React.useCallback(
    (_e, value) => {
      // An exclusive ToggleButtonGroup emits null when the active button is
      // clicked again; there's no "neither view", so ignore it.
      if (!value) return
      history.push({ search: search({ view: value === VIEW_CARDS ? undefined : value }) })
    },
    [history, search],
  )

  const isAdmin = useIsAdmin()

  return (
    <M.Container maxWidth={false} disableGutters className={classes.container}>
      <div className={classes.wrapper} ref={scrollRef}>
        {/* The page's h1, sized as an h5 -- same treatment FrontDoor's greeting
            uses, per DESIGN.md's No-Display-Font Rule (nothing outranks a
            Headline). The predecessor heading here was a `variant="h1"` display
            size on the old marketing-style landing; it does not come back at
            that weight.

            `data-testid` is the end-to-end canaries' "login landed" signal
            (quiltdata/e2e `shared/auth.ts`, `waitForHomePage`). They used to key
            off the literal string "Explore your buckets" and went red the moment
            it was dropped. The same hook is on FrontDoor's h1, so the check holds
            whichever side of the `front-door` flag a stack is on, and the visible
            words stay free to change. */}
        <M.Typography
          variant="h5"
          component="h1"
          color="textPrimary"
          data-testid="landing-heading"
        >
          Volumes
        </M.Typography>
        <div className={classes.filterRow}>
          <M.TextField
            className={classes.filter}
            placeholder="Filter volumes"
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
          <Lab.ToggleButtonGroup
            className={classes.viewToggle}
            value={view}
            exclusive
            size="small"
            onChange={changeView}
          >
            <Lab.ToggleButton
              value={VIEW_CARDS}
              classes={viewToggleButtonClasses}
              aria-label="Card view"
            >
              <Icons.GridOn />
            </Lab.ToggleButton>
            <Lab.ToggleButton
              value={VIEW_LIST}
              classes={viewToggleButtonClasses}
              aria-label="List view"
            >
              <Icons.List />
            </Lab.ToggleButton>
          </Lab.ToggleButtonGroup>
        </div>
        <React.Suspense fallback={<BucketsSkeleton view={view} />}>
          <BucketsBody
            filter={filter}
            sort={sort}
            view={view}
            isAdmin={isAdmin}
            onTagClick={filtering.set}
            onDropTerm={dropTerm}
            scrollRef={scrollRef}
          />
        </React.Suspense>
      </div>
    </M.Container>
  )
}
