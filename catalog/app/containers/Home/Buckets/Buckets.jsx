import cx from 'classnames'
import * as R from 'ramda'
import * as React from 'react'
import { Link, useHistory, useLocation } from 'react-router-dom'
import * as M from '@material-ui/core'
import { fade } from '@material-ui/core/styles'
import * as Icons from '@material-ui/icons'
import * as Lab from '@material-ui/lab'

import Pagination from 'components/Pagination2'
import cfg from 'constants/config'
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
    // Square the outline (2px) so the filter controls — this input and the
    // shortcut tokens — form one crisp, right-angled family, set apart from the
    // circular bucket discs and the pill toggles by shape, not just color.
    '& .MuiOutlinedInput-root': {
      borderRadius: 2,
    },
  },
  viewToggle: {
    flexShrink: 0,
  },
  // The collaborators toggle governs the avatar column at the FAR RIGHT of each
  // bucket row, so push it to the right edge of the filter row — it sits over
  // the column it controls instead of hiding among the left-side controls. A
  // hover tooltip (not a text label) explains it, keeping the control compact.
  // On xs the row is a column, so drop the auto-margin.
  collabToggle: {
    flexShrink: 0,
    marginLeft: 'auto',
    [t.breakpoints.down('xs')]: {
      marginLeft: 0,
    },
  },
  // The shortcuts live on their OWN row beneath the filter controls, not inside
  // filterRow — a growing tag set must never crowd or wrap the filter input.
  tags: {
    alignItems: 'baseline',
    display: 'flex',
    flexWrap: 'wrap',
    gap: t.spacing(1),
  },
  tagsLabel: {
    ...t.typography.overline,
    color: t.palette.text.hint,
    // align the label to the chip row's baseline without stretching
    flexShrink: 0,
    marginRight: t.spacing(0.5),
  },
  // A quiet "filter token", not a loud chip. Two deliberate moves: (1) SQUARE
  // corners (2px) so the tokens read as a distinct class from the circular
  // bucket discs and fully-round Material chips — shape, not just color, does
  // the differentiating; (2) a SOFT tertiary tint at rest (wash fill + tinted
  // text) so the row carries a little brand color without flooding the screen.
  // No '#' prefix — the row is labeled "Shortcuts", so the marker is redundant.
  // The active token fills solid with the tertiary accent.
  shortcut: {
    backgroundColor: fade(t.palette.tertiary.main, 0.08),
    border: `1px solid ${fade(t.palette.tertiary.main, 0.24)}`,
    borderRadius: 2,
    color: t.palette.tertiary.main,
    fontWeight: 500,
    '&:hover': {
      backgroundColor: fade(t.palette.tertiary.main, 0.16),
      borderColor: fade(t.palette.tertiary.main, 0.5),
    },
    '& .MuiChip-label': {
      paddingLeft: t.spacing(1.25),
      paddingRight: t.spacing(1.25),
    },
  },
  // Active token: filled tertiary, so the current filter is unmistakable.
  shortcutActive: {
    backgroundColor: t.palette.tertiary.main,
    borderColor: t.palette.tertiary.main,
    color: t.palette.common.white,
    '&:hover': {
      backgroundColor: t.palette.tertiary.dark,
      borderColor: t.palette.tertiary.dark,
    },
  },
  // The "+N more" / "less" expander: text-weight, no border, so it reads as an
  // action on the row rather than another tag.
  shortcutMore: {
    ...t.typography.body2,
    background: 'none',
    border: 'none',
    color: t.palette.tertiary.main,
    cursor: 'pointer',
    fontWeight: 500,
    padding: t.spacing(0, 0.5),
    '&:hover': {
      textDecoration: 'underline',
    },
  },
  // Empty-search state: a calm readout (Headline-ceiling h6, not a shout) paired
  // with a recovery control so the dead end has an exit — the user isn't left to
  // hunt for the small clear affordance inside the filter field.
  empty: {
    alignItems: 'flex-start',
    display: 'flex',
    flexDirection: 'column',
    gap: t.spacing(2),
    padding: t.spacing(4, 0),
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
  // Collaborators are opt-out: shown by default (PRODUCT mode only), but the
  // scientist scanning volumes can hide the avatar column to reduce the row.
  const [showCollaborators, setShowCollaborators] = React.useState(true)
  // Shortcuts collapse past a threshold so a large tag vocabulary can't flood
  // the layout; the expander reveals the rest on demand.
  const [tagsExpanded, setTagsExpanded] = React.useState(false)
  const scrollRef = React.useRef(null)

  const location = useLocation()
  // 'view' rides beside 'q': absent = 'list' (dense rows), 'card' switches to a grid.
  const { q: filter = '', view: viewMode = 'list' } = parseSearch(location.search)
  const terms = React.useMemo(
    () => filter.toLowerCase().split(/\s+/).filter(Boolean),
    [filter],
  )

  // A tag is "matching" only when it is one of the whole filter terms — not a
  // substring of the filter string. `filter.includes(t)` marked "rna" active
  // while filtering "rna-seq"; comparing against the tokenized terms fixes the
  // false positive on the chip's active state.
  const tagIsMatching = React.useCallback((t) => terms.includes(t.toLowerCase()), [terms])

  const allTags = React.useMemo(
    () =>
      R.pipe(
        R.chain((b) => b.tags || []),
        R.uniq,
        R.sortBy(R.toLower),
      )(buckets),
    [buckets],
  )

  // Cap the shortcut row until expanded. An active (currently-filtering) tag is
  // always shown even past the cap so the live filter never hides behind "more".
  const TAGS_COLLAPSED = 8
  const visibleTags = React.useMemo(() => {
    if (tagsExpanded || allTags.length <= TAGS_COLLAPSED) return allTags
    const head = allTags.slice(0, TAGS_COLLAPSED)
    const active = allTags.filter(
      (t) => terms.includes(t.toLowerCase()) && !head.includes(t),
    )
    return [...head, ...active]
  }, [allTags, tagsExpanded, terms])
  const hiddenTagCount = allTags.length - visibleTags.length

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
        <M.Typography variant="h5" color="textPrimary">
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
          {cfg.mode === 'PRODUCT' && (
            <M.Tooltip
              title={
                showCollaborators
                  ? 'Hide the collaborators column'
                  : 'Show who can access each volume'
              }
            >
              <Lab.ToggleButton
                className={classes.collabToggle}
                value="collaborators"
                size="small"
                selected={showCollaborators}
                onChange={() => setShowCollaborators((s) => !s)}
                aria-label="Toggle collaborators column"
              >
                <Icons.People fontSize="small" />
              </Lab.ToggleButton>
            </M.Tooltip>
          )}
        </div>
        {!!allTags.length && (
          <div className={classes.tags}>
            <span className={classes.tagsLabel}>Shortcuts</span>
            {visibleTags.map((t) => (
              <M.Chip
                key={t}
                className={cx(
                  classes.shortcut,
                  tagIsMatching(t) && classes.shortcutActive,
                )}
                label={t}
                size="small"
                clickable
                // Clicking an already-selected shortcut clears it (toggle off);
                // otherwise it becomes the active filter.
                onClick={() => filtering.set(tagIsMatching(t) ? undefined : t)}
              />
            ))}
            {(hiddenTagCount > 0 || tagsExpanded) && allTags.length > TAGS_COLLAPSED && (
              <button
                type="button"
                className={classes.shortcutMore}
                onClick={() => setTagsExpanded((e) => !e)}
              >
                {tagsExpanded ? 'Show less' : `+${hiddenTagCount} more`}
              </button>
            )}
          </div>
        )}
        {filtered.length || !filter ? (
          viewMode === 'card' ? (
            <BucketGrid
              buckets={paginated}
              onTagClick={filtering.set}
              tagIsMatching={tagIsMatching}
              showAddLink={showAddLink}
              showCollaborators={showCollaborators}
            />
          ) : (
            <BucketList
              buckets={paginated}
              onTagClick={filtering.set}
              tagIsMatching={tagIsMatching}
              showAddLink={showAddLink}
              showCollaborators={showCollaborators}
            />
          )
        ) : (
          <div className={classes.empty}>
            <M.Typography color="textPrimary" variant="h6">
              No volumes matching <b>&quot;{filter}&quot;</b>
            </M.Typography>
            <M.Button
              variant="outlined"
              size="small"
              startIcon={<M.Icon>clear</M.Icon>}
              onClick={clearFilter}
            >
              Clear filter
            </M.Button>
          </div>
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
