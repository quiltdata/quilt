import * as React from 'react'

import * as FiltersUI from 'components/Filters'

import * as SearchUIModel from './model'

interface FilterWidgetProps<
  P extends SearchUIModel.KnownPredicate = SearchUIModel.KnownPredicate,
> {
  state: SearchUIModel.PredicateState<P>
  extents?: SearchUIModel.ExtentsForPredicate<P>
  error: Error | null
  onChange: (state: FiltersUI.Value<SearchUIModel.PredicateState<P>>) => void
  // TODO: units
}

type KeywordWildcardFilterValue = SearchUIModel.Untag<
  SearchUIModel.PredicateState<SearchUIModel.Predicates['KeywordWildcard']>
>

const tagKeywordWildcard = (v: FiltersUI.Value<KeywordWildcardFilterValue>) =>
  v instanceof Error ? v : SearchUIModel.addTag('KeywordWildcard', v)

function KeywordWildcardFilterWidget({
  state,
  onChange,
}: FilterWidgetProps<SearchUIModel.Predicates['KeywordWildcard']>) {
  const handleChange = React.useCallback(
    (v: FiltersUI.Value<KeywordWildcardFilterValue>) => onChange(tagKeywordWildcard(v)),
    [onChange],
  )
  return (
    <FiltersUI.KeywordWildcard
      onChange={handleChange}
      placeholder="Match against (wildcards supported)"
      value={state}
    />
  )
}

const tagText = (queryString: FiltersUI.Value<string>) =>
  queryString instanceof Error
    ? queryString
    : SearchUIModel.addTag('Text', { queryString })

function TextFilterWidget({
  state,
  onChange,
}: FilterWidgetProps<SearchUIModel.Predicates['Text']>) {
  const handleChange = React.useCallback(
    (queryString: FiltersUI.Value<string>) => onChange(tagText(queryString)),
    [onChange],
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
type Boolean = (typeof BOOLEAN_EXTENTS)[number]

const tagBoolean = (value: FiltersUI.Value<readonly Boolean[]>) =>
  value instanceof Error
    ? value
    : SearchUIModel.addTag('Boolean', {
        true: value.includes('true'),
        false: value.includes('false'),
      })

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
    (v: FiltersUI.Value<readonly Boolean[]>) => onChange(tagBoolean(v)),
    [onChange],
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

const tagNumber = (value: FiltersUI.Value<FiltersUI.Numbers>) =>
  value instanceof Error ? value : SearchUIModel.addTag('Number', value)

function NumberFilterWidget({
  state,
  extents,
  error,
  onChange,
}: FilterWidgetProps<SearchUIModel.Predicates['Number']>) {
  // XXX: revisit this logic
  const extentsComputed = React.useMemo(
    () => ({
      min: extents?.min ?? state.gte ?? 0,
      max: extents?.max ?? state.lte ?? 0,
    }),
    [extents?.min, extents?.max, state.gte, state.lte],
  )
  const handleChange = React.useCallback(
    (value: FiltersUI.Value<FiltersUI.Numbers>) => onChange(tagNumber(value)),
    [onChange],
  )
  return (
    <FiltersUI.NumbersRange
      error={error}
      extents={extentsComputed}
      initialValue={state}
      onChange={handleChange}
      // XXX: add units for known filters
      // unit={unit}
    />
  )
}

const tagDatetime = (value: FiltersUI.Value<FiltersUI.Dates>) =>
  value instanceof Error ? value : SearchUIModel.addTag('Datetime', value)

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

  const handleChange = React.useCallback(
    (v: FiltersUI.Value<FiltersUI.Dates>) => onChange(tagDatetime(v)),
    [onChange],
  )

  return (
    <FiltersUI.DatesRange
      error={error}
      extents={extentsComputed}
      onChange={handleChange}
      value={state}
    />
  )
}

const tagEnum = (terms: FiltersUI.Value<readonly string[]>) =>
  terms instanceof Error ? terms : SearchUIModel.addTag('KeywordEnum', { terms })

const EMPTY_TERMS: readonly string[] = []

function KeywordEnumFilterWidget({
  error,
  state,
  extents,
  onChange,
}: FilterWidgetProps<SearchUIModel.Predicates['KeywordEnum']>) {
  const handleChange = React.useCallback(
    (value: FiltersUI.Value<readonly string[]>) => onChange(tagEnum(value)),
    [onChange],
  )
  const extentsComputed = extents?.values ?? EMPTY_TERMS
  return (
    <FiltersUI.List
      error={error}
      extents={extentsComputed}
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
