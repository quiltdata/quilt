import invariant from 'invariant'
import * as React from 'react'
import * as M from '@material-ui/core'
import { useDebouncedCallback } from 'use-debounce'

import * as FiltersUI from 'components/Filters'
import * as GQL from 'utils/GraphQL'
import assertNever from 'utils/assertNever'

import FilterWidget from '../FilterWidget'
import { OBJECT_FILTER_LABELS } from '../i18n'
import * as SearchUIModel from '../model'

import FilterSection from './FilterSection'
import MoreButton from './MoreButton'

interface ObjectsFilterProps {
  className?: string
  field: keyof SearchUIModel.ObjectsSearchFilter
}

function ObjectsFilter({ className, field }: ObjectsFilterProps) {
  const model = SearchUIModel.use(SearchUIModel.ResultType.S3Object)

  const initialValue = model.state.filter.predicates[field]
  invariant(initialValue, 'Filter not active')

  const extents = GQL.fold(model.baseSearchQuery, {
    data: ({ searchObjects: r }) => {
      switch (r.__typename) {
        case 'EmptySearchResultSet':
          return undefined
        case 'InvalidInput':
          return undefined
        case 'ObjectsSearchResultSet':
          if (field === 'modified' || field === 'size' || field === 'ext') {
            return r.stats[field]
          }
          return undefined
        default:
          assertNever(r)
      }
    },
    fetching: () => undefined,
    error: () => undefined,
  })

  const { deactivateObjectsFilter, setObjectsFilter } = model.actions

  type ObjectFilterState = NonNullable<Parameters<typeof setObjectsFilter>[1]>

  const [value, setValue] = React.useState<ObjectFilterState>(initialValue)
  const [error, setError] = React.useState<Error | null>(null)

  const deactivate = React.useCallback(() => {
    deactivateObjectsFilter(field)
  }, [deactivateObjectsFilter, field])

  const { _tag: tag } = initialValue
  const debounceOptions = React.useMemo(
    () => ({ leading: tag === 'KeywordEnum' || tag === 'Boolean' }),
    [tag],
  )
  const onChange = useDebouncedCallback(setObjectsFilter, 500, debounceOptions)

  const handleChange = React.useCallback(
    (state: FiltersUI.Value<ObjectFilterState>) => {
      if (state instanceof Error) {
        setError(state)
      } else {
        setError(null)
        setValue(state)
        onChange(field, state)
      }
    },
    [onChange, field],
  )

  return (
    <FiltersUI.Container
      className={className}
      defaultExpanded
      onDeactivate={deactivate}
      title={OBJECT_FILTER_LABELS[field]}
    >
      <FilterWidget
        error={error}
        state={value}
        extents={extents}
        onChange={handleChange}
      />
    </FiltersUI.Container>
  )
}

interface ObjectsFilterActivatorProps {
  field: keyof SearchUIModel.ObjectsSearchFilter
}

function ObjectsFilterActivator({ field }: ObjectsFilterActivatorProps) {
  const model = SearchUIModel.use(SearchUIModel.ResultType.S3Object)
  const { activateObjectsFilter } = model.actions
  const activate = React.useCallback(() => {
    activateObjectsFilter(field)
  }, [activateObjectsFilter, field])
  return <FiltersUI.Activator title={OBJECT_FILTER_LABELS[field]} onClick={activate} />
}

const OBJECTS_FILTERS_PRIMARY = ['modified', 'ext'] as const

const OBJECTS_FILTERS_SECONDARY = ['size', 'key', 'content', 'deleted'] as const

const useObjectFiltersStyles = M.makeStyles((t) => ({
  more: {
    marginTop: t.spacing(0.5),
  },
  title: {
    ...t.typography.h6,
    fontWeight: 400,
    marginBottom: t.spacing(1),
  },
}))

interface ObjectFiltersProps {
  className: string
}

export default function ObjectFilters({ className }: ObjectFiltersProps) {
  const model = SearchUIModel.use(SearchUIModel.ResultType.S3Object)
  const classes = useObjectFiltersStyles()

  const { order: activeFilters, predicates } = model.state.filter

  const availableFilters = OBJECTS_FILTERS_PRIMARY.filter((f) => !predicates[f])
  const moreFilters = OBJECTS_FILTERS_SECONDARY.filter((f) => !predicates[f])

  const [expanded, setExpanded] = React.useState(false)
  const toggleExpanded = React.useCallback(() => setExpanded((x) => !x), [])

  return (
    <div className={className}>
      <div className={classes.title}>Filter by</div>

      {activeFilters.map((f) => (
        <FilterSection key={f}>
          <ObjectsFilter field={f} />
        </FilterSection>
      ))}

      {!!availableFilters.length && (
        <M.List dense disablePadding>
          {availableFilters.map((f) => (
            <ObjectsFilterActivator key={f} field={f} />
          ))}
        </M.List>
      )}

      {!!moreFilters.length && (
        <>
          <M.Collapse in={expanded}>
            <M.List dense disablePadding>
              {moreFilters.map((f) => (
                <ObjectsFilterActivator key={f} field={f} />
              ))}
            </M.List>
          </M.Collapse>
          <MoreButton
            className={classes.more}
            onClick={toggleExpanded}
            reverse={expanded}
          />
        </>
      )}
    </div>
  )
}
