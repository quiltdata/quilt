import { useDebouncedCallback } from 'use-debounce'
import * as React from 'react'

import * as FiltersUI from 'components/Filters'

import * as SearchUIModel from './model'

interface DebouncedState<T> {
  value: T
  set: (value: T) => void
}

function useDebouncedState<T>(
  initialValue: T,
  onChange: (value: T) => void,
  delay: number,
): DebouncedState<T> {
  const [value, setValue] = React.useState<T>(initialValue)
  const debouncedCallback = useDebouncedCallback(onChange, delay)

  React.useEffect(() => {
    if (!debouncedCallback.isPending()) setValue(initialValue)
  }, [debouncedCallback, initialValue])

  React.useEffect(() => () => debouncedCallback.flush(), [debouncedCallback])

  const set = React.useCallback(
    (newValue: T) => {
      setValue(newValue)
      debouncedCallback(newValue)
    },
    [debouncedCallback],
  )

  return { value, set }
}

function KeywordWildcardFilterWidget({
  state,
  onChange,
}: FilterWidgetProps<SearchUIModel.Predicates['KeywordWildcard']>) {
  const handleWildcardChange = React.useCallback(
    (wildcard: string) => {
      onChange({ ...state, wildcard })
    },
    [onChange, state],
  )

  const handleStrictChange = React.useCallback(
    (strict: boolean) => {
      onChange({ ...state, strict })
    },
    [onChange, state],
  )

  const debounced = useDebouncedState(state.wildcard, handleWildcardChange, 500)

  // TODO: link to docs:
  // https://www.elastic.co/guide/en/elasticsearch/reference/6.8/query-dsl-wildcard-query.html
  return (
    <FiltersUI.KeywordWildcard
      onChange={debounced.set}
      placeholder="Match against (wildcards supported)"
      value={debounced.value}
      strict={state.strict}
      onStrictChange={handleStrictChange}
    />
  )
}

function TextFilterWidget({
  state,
  onChange,
}: FilterWidgetProps<SearchUIModel.Predicates['Text']>) {
  const handleChange = React.useCallback(
    (queryString: string) => {
      onChange({ ...state, queryString })
    },
    [onChange, state],
  )

  const debounced = useDebouncedState(state.queryString, handleChange, 500)

  // TODO: link to docs:
  // https://www.elastic.co/guide/en/elasticsearch/reference/6.8/query-dsl-simple-query-string-query.html
  return (
    <FiltersUI.TextField
      onChange={debounced.set}
      placeholder="Search for"
      value={debounced.value}
    />
  )
}

type BooleanFilterValue = SearchUIModel.Untag<
  SearchUIModel.PredicateState<SearchUIModel.Predicates['Boolean']>
>

function BooleanFilterWidget({
  state,
  onChange,
}: FilterWidgetProps<SearchUIModel.Predicates['Boolean']>) {
  const handleChange = React.useCallback(
    (value: BooleanFilterValue) => {
      onChange({ ...state, ...value })
    },
    [onChange, state],
  )
  return <FiltersUI.BooleanFilter onChange={handleChange} value={state} />
}

interface FilterWidgetProps<
  P extends SearchUIModel.KnownPredicate = SearchUIModel.KnownPredicate,
> {
  state: SearchUIModel.PredicateState<P>
  extents?: SearchUIModel.ExtentsForPredicate<P>
  onChange: (state: SearchUIModel.PredicateState<P>) => void
}

const NO_RANGE_EXTENTS = { min: undefined, max: undefined }

function NumberFilterWidget({
  state,
  extents,
  onChange,
}: FilterWidgetProps<SearchUIModel.Predicates['Number']>) {
  const handleChange = React.useCallback(
    (v: { gte: number | null; lte: number | null }) => onChange({ ...state, ...v }),
    [onChange, state],
  )
  const value = React.useMemo(() => {
    const { gte, lte } = state
    return { gte, lte }
  }, [state])
  const debounced = useDebouncedState(value, handleChange, 500)
  return (
    <FiltersUI.NumbersRange
      extents={extents || NO_RANGE_EXTENTS}
      onChange={debounced.set}
      // TODO: add units for known filters
      // unit={unit}
      value={debounced.value}
    />
  )
}

function DatetimeFilterWidget({
  extents,
  onChange,
  state,
}: FilterWidgetProps<SearchUIModel.Predicates['Datetime']>) {
  const handleChange = React.useCallback(
    (v: { gte: Date | null; lte: Date | null }) => onChange({ ...state, ...v }),
    [onChange, state],
  )
  const value = React.useMemo(() => {
    const { gte, lte } = state
    return { gte, lte }
  }, [state])
  const debounced = useDebouncedState(value, handleChange, 500)
  return (
    <FiltersUI.DatesRange
      extents={extents || NO_RANGE_EXTENTS}
      onChange={debounced.set}
      value={debounced.value}
    />
  )
}

const EMPTY_TERMS: string[] = []

function KeywordEnumFilterWidget({
  state,
  extents,
  onChange,
}: FilterWidgetProps<SearchUIModel.Predicates['KeywordEnum']>) {
  const handleChange = React.useCallback(
    (value: string[]) => {
      onChange({ ...state, terms: value })
    },
    [onChange, state],
  )
  const availableValues = extents?.values ?? EMPTY_TERMS

  return (
    <FiltersUI.List
      extents={availableValues}
      onChange={handleChange}
      value={state.terms}
      placeholder="Find"
    />
  )
}

const WIDGETS = {
  Datetime: DatetimeFilterWidget,
  Number: NumberFilterWidget,
  Text: TextFilterWidget,
  KeywordEnum: KeywordEnumFilterWidget,
  KeywordWildcard: KeywordWildcardFilterWidget,
  Boolean: BooleanFilterWidget,
}

export default function FilterWidget(props: FilterWidgetProps) {
  const Widget = WIDGETS[props.state._tag]
  return <Widget {...(props as $TSFixMe)} />
}
