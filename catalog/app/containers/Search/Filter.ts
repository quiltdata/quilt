import * as Eff from 'effect'
import * as S from '@effect/schema/Schema'

import * as Nav from 'utils/Navigation'

import * as Predicates from './Predicates'

type PredicateMap = Record<
  string,
  { type: Predicates.PredicateIO<any, any>; title: string }
>

type FilterEntry<PM extends PredicateMap, K extends keyof PM = keyof PM> = {
  key: K
  predicate: PM[K]['type']['state']['Type']
}

type CombinedState<PM extends PredicateMap> = readonly FilterEntry<PM>[]

interface FilterIO<PM extends PredicateMap> {
  state: S.Schema<CombinedState<PM>>
  fromSearchParams: S.Schema<CombinedState<PM>, typeof Nav.SearchParams.Type>

  children: PM
  initialState: CombinedState<PM>
}

function Filter<const PM extends PredicateMap>(
  title: string,
  children: PM,
): FilterIO<PM> {
  const entries = Eff.Record.collect(
    children,
    (key, c) =>
      S.Struct({
        key: S.tag(key),
        predicate: c.type.state,
      }).annotations({ title: c.title }) as S.Schema<FilterEntry<PM>>,
  )

  const state: S.Schema<CombinedState<PM>> = S.Array(S.Union(...entries)).annotations({
    title: `CombinedState(${Object.keys(children).join(', ')})`,
  })

  const initState = () => [] as CombinedState<PM>

  const fromSearchParams = S.transform(Nav.SearchParams, state, {
    decode: Eff.Record.reduce(initState(), (acc, v, key) =>
      Eff.pipe(
        Eff.Record.get(children, key),
        Eff.Option.map((c) => c.type),
        Eff.Option.flatMap((pio) =>
          Eff.Option.flatMap(Eff.Array.last(v), S.decodeUnknownOption(pio.str)),
        ),
        Eff.Option.match({
          onNone: () => acc,
          // TODO: filter-out duplicate keys
          onSome: (predicate) => acc.concat({ key, predicate }),
        }),
      ),
    ),
    encode: Eff.flow(
      Eff.Array.filterMap(({ key, predicate }) =>
        Eff.pipe(
          predicate,
          S.encodeOption(children[key as keyof PM].type.str),
          Eff.Option.map((s) => [key as string, [s]] as const),
        ),
      ),
      Eff.Record.fromEntries,
    ),
  }).annotations({ title: `${title}Filter (from SearchParams)` })

  const initialState = initState()

  return {
    state,
    fromSearchParams,
    children,
    initialState,
  }
}

export const PackageFilter = Filter('Package', {
  modified: {
    type: Predicates.Datetime,
    title: 'last modified date',
  },
  size: {
    type: Predicates.Number,
    title: 'file size in bytes',
  },
  name: {
    type: Predicates.KeywordWildcard,
    title: 'package name (aka namespace)',
  },
  hash: {
    type: Predicates.KeywordWildcard,
    title: 'package revision hash',
  },
  entries: {
    type: Predicates.Number,
    title: 'number of package entries',
  },
  comment: {
    type: Predicates.Text,
    title: 'package revision comment (aka commit message)',
  },
  workflow: {
    type: Predicates.KeywordEnum,
    title: 'package workflow',
  },
})

export const ObjectFilter = Filter('Object', {
  modified: {
    type: Predicates.Datetime,
    title: 'last modified date',
  },
  size: {
    type: Predicates.Number,
    title: 'file size in bytes',
  },
  ext: {
    type: Predicates.KeywordEnum,
    title: 'file extensions (with a leading dot)',
  },
  key: {
    type: Predicates.KeywordWildcard,
    title: 'file name (aka S3 Object Key)',
  },
  content: {
    type: Predicates.Text,
    title: 'indexed text contents',
  },
  deleted: {
    type: Predicates.Boolean,
    title: 'whether a file is a delete marker',
  },
})
