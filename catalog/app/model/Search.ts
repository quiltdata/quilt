import * as Types from 'utils/types'

// model of faceted search domain

export type FacetPath = readonly string[]

// eslint-disable-next-line @typescript-eslint/no-redeclare
function FacetPath(...segments: string[]): FacetPath {
  return segments
}

export interface Predicate {
  readonly op: string
  readonly arg: Types.Json
}

// eslint-disable-next-line @typescript-eslint/no-redeclare
export function Predicate(op: string, arg: Types.Json) {
  return { op, arg }
}

export interface FilterClause {
  path: FacetPath
  predicate: Predicate
  negate: boolean // defaults to false
}

// eslint-disable-next-line @typescript-eslint/no-redeclare
export function FilterClause(
  path: FacetPath,
  predicate: Predicate,
  negate: boolean = false,
): FilterClause {
  return { path, predicate, negate }
}

type FilterCombinator = 'AND' | 'OR'

export interface FilterCombination {
  children: (FilterClause | FilterCombination)[]
  combinator: FilterCombinator // defaults to AND
  negate: boolean // defaults to false
}

interface FilterOpts {
  combinator?: FilterCombinator
  negate?: boolean
}

// eslint-disable-next-line @typescript-eslint/no-redeclare
export function FilterCombination(
  children: (FilterClause | FilterCombination)[],
  opts: FilterOpts = {},
): FilterCombination {
  return { children, combinator: opts.combinator ?? 'AND', negate: opts.negate ?? false }
}

export type FilterExpression = FilterClause | FilterCombination

// example
// const filter = FilterCombination(
//   [
//     FilterClause(
//       FacetPath('s3', 'size'),
//       Predicates.Between(1, 1000),
//     ),
//     FilterClause(
//       FacetPath('pkg_meta', 'owner', 'keyword'),
//       Predicates.In('Alexei', 'Sergey', 'Max'),
//     ),
//     FilterClause(
//       FacetPath('pkg_meta', 'owner', 'keyword'),
//       Predicates.In('Alexei', 'Sergey', 'Max'),
//     ),
//     // FilterCombination(...), // can be nested
//   ],
//   {
//     combinator: 'OR',
//     negate: true,
//   },
// )

// interface SearchCriteria {
//   searchString?: string
//   filter?: FilterCombination
// }
//
// interface SearchOptions {
//   // retry: number
//   // order: ?
//   // facetOptions: ?
// }
//
// type SearchParameters = SearchCriteria & SearchOptions

// TODO: import SearchFacetSource enum from gql
export type FacetSource = $TSFixMe

// TODO: import SearchFacetType enum from gql
export type FacetType = $TSFixMe

interface ResultTypeExtents {
  // type: FacetType.ResultType
  // TODO
  // types: ResultType[]
}

interface BucketExtents {
  // type: FacetType.Bucket
  buckets: string[]
}

interface WorkflowExtents {
  // type: FacetType.Workflow
  // TODO
}

interface NumberExtents {
  min: number
  max: number
}

interface DateExtents {
  min: number
  max: number
}

export type FacetExtents =
  | ResultTypeExtents
  | BucketExtents
  | WorkflowExtents
  | NumberExtents
  | DateExtents

// TODO: validate runtime data with IO-TS or smth and assert stricter types
// type FacetStats = FacetStatsResultType | FacetStatsBucket | FacetStatsWorkflow // | ... other types ...

// interface Facet {
//   source: FacetSource
//   name: string
//   path: string[]
//   stats: FacetStats
// }
