import * as React from 'react'
import * as M from '@material-ui/core'

import * as FiltersUI from 'components/Filters'
import * as JSONPointer from 'utils/JSONPointer'
import FilterWidget from 'containers/Search/FilterWidget'
import * as SearchUIModel from 'containers/Search/model'

import FacetPicker, { OnSelect } from './FacetPicker'
import Preview from './Preview'
import * as Model from './model'

// The authoring surface for a predicate rule (A11): a package-name pattern, an
// entry-path pattern, and any number of package-metadata filters, with a live
// preview of what the three currently resolve to.
//
// Controlled: the definition form owns the draft, because saving is its job and
// a predicate is one field of a larger definition.

const useStyles = M.makeStyles((t) => ({
  root: {},
  section: {
    marginBottom: t.spacing(3),
  },
  sectionTitle: {
    ...t.typography.subtitle2,
    marginBottom: t.spacing(1),
  },
  patterns: {
    display: 'grid',
    gap: t.spacing(2),
    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
  },
  error: {
    marginBottom: t.spacing(2),
  },
  empty: {
    ...t.typography.caption,
    color: t.palette.text.secondary,
  },
}))

interface ActiveFilterProps {
  buckets: readonly string[]
  path: string
  state: SearchUIModel.PredicateState<SearchUIModel.KnownPredicate>
  onChange: (state: SearchUIModel.PredicateState<SearchUIModel.KnownPredicate>) => void
  onDeactivate: () => void
}

// One activated metadata filter. Its own component so each gets its own
// extents query -- a hook cannot run in a loop.
function ActiveFilter({
  buckets,
  path,
  state,
  onChange,
  onDeactivate,
}: ActiveFilterProps) {
  const { fetching, extents } = Model.useFacetExtents(buckets, path, state._tag)

  // `/a/b` reads as "a / b"; the raw JSON pointer is not a label.
  const title = React.useMemo(() => JSONPointer.parse(path).join(' / '), [path])

  return (
    <FiltersUI.Container title={title} onDeactivate={onDeactivate} extenting={fetching}>
      <FilterWidget state={state} extents={extents} onChange={onChange} />
    </FiltersUI.Container>
  )
}

interface PredicateBuilderProps {
  // Which buckets the facet vocabulary and the preview are drawn from. A
  // predicate is only meaningful against the buckets the product can see.
  buckets: readonly string[]
  className?: string
  disabled?: boolean
  // A save-time rejection from the registry, rendered inline rather than
  // thrown: an author who wrote a bad pattern should be able to fix it in
  // place (AC: InvalidInput surfaces inline, not as a crash).
  error?: string | null
  onChange: (draft: Model.PredicateDraft) => void
  value: Model.PredicateDraft
}

export default function PredicateBuilder({
  buckets,
  className,
  disabled,
  error,
  onChange,
  value,
}: PredicateBuilderProps) {
  const classes = useStyles()

  const available = Model.useAvailableFacets(buckets)
  const preview = Model.usePreview(buckets, value)

  const setPackageNamePattern = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) =>
      onChange({ ...value, packageNamePattern: e.target.value }),
    [onChange, value],
  )

  const setEntryPathPattern = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) =>
      onChange({ ...value, entryPathPattern: e.target.value }),
    [onChange, value],
  )

  const handleSelect: OnSelect = React.useCallback(
    (path, tag) =>
      onChange({
        ...value,
        userMetaFilters: value.userMetaFilters.activateFilter(path, tag),
      }),
    [onChange, value],
  )

  const handleDeactivate = React.useCallback(
    (path: string) => () =>
      onChange({
        ...value,
        userMetaFilters: value.userMetaFilters.deactivateFilter(path),
      }),
    [onChange, value],
  )

  const handleFilterChange = React.useCallback(
    (path: string) =>
      (state: SearchUIModel.PredicateState<SearchUIModel.KnownPredicate>) =>
        onChange({
          ...value,
          userMetaFilters: value.userMetaFilters.setFilter(path, state),
        }),
    [onChange, value],
  )

  const active = Array.from(value.userMetaFilters.filters)

  return (
    <div className={className}>
      {!!error && (
        <M.Typography
          className={classes.error}
          color="error"
          variant="body2"
          data-testid="predicate-builder--error"
        >
          {error}
        </M.Typography>
      )}

      <div className={classes.section}>
        <div className={classes.patterns}>
          <M.TextField
            disabled={disabled}
            fullWidth
            helperText="e.g. team/* — leave empty to match any package"
            inputProps={{ 'data-testid': 'predicate-package-name' }}
            label="Package name pattern"
            onChange={setPackageNamePattern}
            value={value.packageNamePattern}
          />
          <M.TextField
            disabled={disabled}
            fullWidth
            helperText="e.g. results/*.csv — leave empty to include every entry"
            inputProps={{ 'data-testid': 'predicate-entry-path' }}
            label="Entry path pattern"
            onChange={setEntryPathPattern}
            value={value.entryPathPattern}
          />
        </div>
      </div>

      <div className={classes.section}>
        <div className={classes.sectionTitle}>Metadata filters</div>
        {active.length ? (
          active.map(([path, state]) => (
            <ActiveFilter
              buckets={buckets}
              key={path}
              onChange={handleFilterChange(path)}
              onDeactivate={handleDeactivate(path)}
              path={path}
              state={state}
            />
          ))
        ) : (
          <p className={classes.empty}>
            No metadata filters yet. Pick a field below to add one.
          </p>
        )}
        <FacetPicker
          disabled={disabled}
          facets={available.facets}
          fetching={available.fetching}
          onSelect={handleSelect}
          truncated={available.truncated}
        />
      </div>

      <div className={classes.section}>
        <div className={classes.sectionTitle}>Preview</div>
        <Preview state={preview} />
      </div>
    </div>
  )
}
