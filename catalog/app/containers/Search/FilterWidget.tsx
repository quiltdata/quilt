import * as React from 'react'

import * as FiltersUI from 'components/Filters'

import * as SearchUIModel from './model'

type KeywordWildcardFilterValue = SearchUIModel.Untag<
  SearchUIModel.PredicateState<SearchUIModel.Predicates['KeywordWildcard']>
>

function KeywordWildcardFilterWidget({
  state,
  onChange,
}: FilterWidgetProps<SearchUIModel.Predicates['KeywordWildcard']>) {
  const handleChange = React.useCallback(
    (v: FiltersUI.Value<KeywordWildcardFilterValue>) => {
      if (v instanceof Error) {
        onChange(v)
      } else {
        onChange(SearchUIModel.addTag(state._tag, v))
      }
    },
    [onChange, state],
  )
  return (
    <FiltersUI.KeywordWildcard
      onChange={handleChange}
      placeholder="Match against (wildcards supported)"
      value={state}
    />
  )
}

function TextFilterWidget({
  state,
  onChange,
}: FilterWidgetProps<SearchUIModel.Predicates['Text']>) {
  const handleChange = React.useCallback(
    (queryString: FiltersUI.Value<string>) => {
      if (queryString instanceof Error) {
        onChange(queryString)
      } else {
        onChange(SearchUIModel.addTag(state._tag, { queryString }))
      }
    },
    [onChange, state],
  )

  // TODO: link to docs:
  // https://www.elastic.co/guide/en/elasticsearch/reference/6.8/query-dsl-simple-query-string-query.html
  return (
    <FiltersUI.TextField
      onChange={handleChange}
      placeholder="Search for"
      value={state.queryString}
    />
  )
}

const BOOLEAN_EXTENTS = ['true', 'false'] as const
// type Boolean = (typeof BOOLEAN_EXTENTS)[number]

function BooleanFilterWidget({
  error,
  onChange,
  state,
}: FilterWidgetProps<SearchUIModel.Predicates['Boolean']>) {
  const value = React.useMemo(
    () => BOOLEAN_EXTENTS.filter((bool) => state[bool]),
    [state],
  )
  const handleChange = React.useCallback(
    (v: FiltersUI.Value<string[]>) => {
      if (v instanceof Error) {
        onChange(v)
      } else {
        onChange(
          SearchUIModel.addTag(state._tag, {
            true: v.includes('true'),
            false: v.includes('false'),
          }),
        )
      }
    },
    [onChange, state],
  )
  return (
    <FiltersUI.List
      error={error}
      extents={BOOLEAN_EXTENTS}
      onChange={handleChange}
      value={value}
    />
  )
}

interface FilterWidgetProps<
  P extends SearchUIModel.KnownPredicate = SearchUIModel.KnownPredicate,
> {
  state: SearchUIModel.PredicateState<P>
  extents?: SearchUIModel.ExtentsForPredicate<P>
  error: Error | null
  onChange: (state: FiltersUI.Value<SearchUIModel.PredicateState<P>>) => void
  // TODO: units
}

function NumberFilterWidget({
  state,
  extents,
  error,
  onChange,
}: FilterWidgetProps<SearchUIModel.Predicates['Number']>) {
  const handleChange = React.useCallback(
    (value: FiltersUI.Value<{ min: number | null; max: number | null }>) => {
      if (value instanceof Error) {
        onChange(value)
      } else {
        const { min: gte, max: lte } = value
        onChange(SearchUIModel.addTag(state._tag, { gte, lte }))
      }
    },
    [onChange, state],
  )

  // XXX: revisit this logic
  const extentsComputed = React.useMemo(
    () => ({
      min: extents?.min ?? state.gte ?? 0,
      max: extents?.max ?? state.lte ?? 0,
    }),
    [extents?.min, extents?.max, state.gte, state.lte],
  )

  const initialValue = React.useMemo(() => ({ min: state.gte, max: state.lte }), [state])

  return (
    <FiltersUI.NumbersRange
      error={error}
      extents={extentsComputed}
      initialValue={initialValue}
      onChange={handleChange}
      // XXX: add units for known filters
      // unit={unit}
    />
  )
}

function DatetimeFilterWidget({
  error,
  state,
  extents,
  onChange,
}: FilterWidgetProps<SearchUIModel.Predicates['Datetime']>) {
  const extentsComputed = React.useMemo(
    () => ({
      min: extents?.min ?? new Date(),
      max: extents?.max ?? new Date(),
    }),
    [extents?.min, extents?.max],
  )

  const value = React.useMemo(
    () => ({ min: state.gte, max: state.lte }),
    [state.gte, state.lte],
  )

  const handleChange = React.useCallback(
    (v: FiltersUI.Value<{ min: Date | null; max: Date | null }>) => {
      if (v instanceof Error) {
        onChange(v)
      } else {
        onChange(SearchUIModel.addTag(state._tag, { gte: v.min, lte: v.max }))
      }
    },
    [onChange, state],
  )

  return (
    <FiltersUI.DatesRange
      error={error}
      extents={extentsComputed}
      onChange={handleChange}
      value={value}
    />
  )
}

const EMPTY_TERMS: string[] = []

function KeywordEnumFilterWidget({
  error,
  state,
  extents,
  onChange,
}: FilterWidgetProps<SearchUIModel.Predicates['KeywordEnum']>) {
  const handleChange = React.useCallback(
    (value: FiltersUI.Value<string[]>) => {
      if (value instanceof Error) {
        onChange(value)
      } else {
        onChange(SearchUIModel.addTag(state._tag, { terms: value }))
      }
    },
    [onChange, state],
  )
  const availableValues = extents?.values ?? EMPTY_TERMS

  return (
    <FiltersUI.List
      error={error}
      extents={availableValues}
      onChange={handleChange}
      placeholder="Find"
      value={state.terms}
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
