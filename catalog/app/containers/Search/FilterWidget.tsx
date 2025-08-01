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
        onChange({ ...state, ...v })
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
        onChange({ ...state, queryString })
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

type BooleanFilterValue = SearchUIModel.Untag<
  SearchUIModel.PredicateState<SearchUIModel.Predicates['Boolean']>
>

function BooleanFilterWidget({
  state,
  onChange,
}: FilterWidgetProps<SearchUIModel.Predicates['Boolean']>) {
  const handleChange = React.useCallback(
    (value: FiltersUI.Value<BooleanFilterValue>) => {
      if (value instanceof Error) {
        onChange(value)
      } else {
        onChange({ ...state, ...value })
      }
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
  onChange: (state: FiltersUI.Value<SearchUIModel.PredicateState<P>>) => void
}

function NumberFilterWidget({
  state,
  extents,
  onChange,
}: FilterWidgetProps<SearchUIModel.Predicates['Number']>) {
  const handleChange = React.useCallback(
    (value: FiltersUI.Value<{ min: number | null; max: number | null }>) => {
      if (value instanceof Error) {
        onChange(value)
      } else {
        onChange({ ...state, gte: value.min, lte: value.max })
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

  return (
    <FiltersUI.NumbersRange
      extents={extentsComputed}
      onChange={handleChange}
      // XXX: add units for known filters
      // unit={unit}
      value={{ min: state.gte, max: state.lte }}
    />
  )
}

function DatetimeFilterWidget({
  state,
  extents,
  onChange,
}: FilterWidgetProps<SearchUIModel.Predicates['Datetime']>) {
  const fixedExtents = React.useMemo(
    () => ({
      min: extents?.min ?? new Date(),
      max: extents?.max ?? new Date(),
    }),
    [extents?.min, extents?.max],
  )

  const fixedValue = React.useMemo(
    () => ({ min: state.gte, max: state.lte }),
    [state.gte, state.lte],
  )

  const handleChange = React.useCallback(
    (v: { min: Date | null; max: Date | null }) => {
      onChange({ ...state, gte: v.min, lte: v.max })
    },
    [onChange, state],
  )

  return (
    <FiltersUI.DatesRange
      extents={fixedExtents}
      onChange={handleChange}
      value={fixedValue}
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
