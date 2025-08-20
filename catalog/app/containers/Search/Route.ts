import * as Eff from 'effect'
import { Schema as S } from 'effect'

import * as SearchModel from 'containers/Search/model'
import * as routes from 'constants/routes'
import * as Model from 'model'
import * as Nav from 'utils/Navigation'

import * as Filter from './Filter'
import * as UserMetaFilters from './UserMetaFilters'

const PackageSearchParamsSchema = S.Struct({
  resultType: S.tag(SearchModel.ResultType.QuiltPackage).annotations({
    title: 'Result type: Quilt Package',
  }),
  filter: S.optional(Filter.PackageFilter.state).annotations({
    title: 'Result filters (system metadata)',
    description: 'Filter results by system metadata',
  }),
  userMetaFilters: S.optional(UserMetaFilters.UserMetaFiltersSchema).annotations({
    title: 'Result filters (user metadata)',
    description: 'Filter results by user metadata',
  }),
  latestOnly: S.optional(S.Boolean).annotations({
    title: 'Latest only',
    description: 'Search only latest revisions',
  }),
}).annotations({
  title: 'Package-specific search parameters',
})

const PackageSearchParamsFromSearchParams = S.transform(
  Nav.SearchParams,
  PackageSearchParamsSchema,
  {
    // qs to json api
    decode: (params) => ({
      resultType: SearchModel.ResultType.QuiltPackage as const,
      filter: S.decodeSync(Filter.PackageFilter.fromSearchParams)(params),
      userMetaFilters: S.decodeSync(UserMetaFilters.fromSearchParams)(params),
      latestOnly: params.rev?.[0] !== 'all',
    }),
    // json api to qs
    encode: (toI) => ({
      ...S.encodeSync(Filter.PackageFilter.fromSearchParams)(toI.filter || []),
      ...S.encodeSync(UserMetaFilters.fromSearchParams)(toI.userMetaFilters || []),
      ...((toI.latestOnly ?? true) ? {} : { rev: ['all'] }),
    }),
  },
)

const ObjectSearchParamsSchema = S.Struct({
  resultType: S.tag(SearchModel.ResultType.S3Object).annotations({
    title: 'Result type: S3 Object',
  }),
  filter: S.optional(Filter.ObjectFilter.state).annotations({
    title: 'Result filters',
  }),
}).annotations({
  title: 'Object-specific search parameters',
})

const ObjectSearchParamsFromSearchParams = S.transform(
  Nav.SearchParams,
  ObjectSearchParamsSchema,
  {
    // qs to json api
    decode: Eff.flow(S.decodeSync(Filter.ObjectFilter.fromSearchParams), (filter) => ({
      resultType: SearchModel.ResultType.S3Object as const,
      filter,
    })),
    // json api to qs
    encode: Eff.flow(
      (toI) => toI.filter || [],
      S.encodeSync(Filter.ObjectFilter.fromSearchParams),
    ),
  },
)

const SearchParamsSchema = S.Struct({
  searchString: S.optional(S.String).annotations({
    title: 'Search string',
    description:
      'A String to search for. ElasticSearch syntax supported. For packages, searches in package name, comment (commit message), and metadata. For objects, searches in object key and indexed content.',
  }),
  buckets: S.optional(S.Array(S.String)).annotations({
    title: 'Search buckets',
    description: 'A list of buckets to search in (keep empty to search in all buckets)',
  }),
  order: S.optional(S.Enums(Model.GQLTypes.SearchResultOrder)).annotations({
    title: 'Search result order',
    description: 'Order of search results',
  }),
  params: S.Union(PackageSearchParamsSchema, ObjectSearchParamsSchema).annotations({
    title: 'Result type-specific parameters',
  }),
})

const OrderFromNullableString = S.transform(
  S.NullOr(S.String),
  S.Enums(Model.GQLTypes.SearchResultOrder),
  {
    encode: (input) => (input === SearchModel.DEFAULT_ORDER ? null : input),
    decode: (input) =>
      Object.values(Model.GQLTypes.SearchResultOrder).includes(input as any)
        ? (input as Model.GQLTypes.SearchResultOrder)
        : SearchModel.DEFAULT_ORDER,
  },
)

const ResultTypeFromNullableString = S.transform(
  S.NullOr(S.String),
  S.Enums(SearchModel.ResultType),
  {
    encode: (input) => (input === SearchModel.DEFAULT_RESULT_TYPE ? null : input),
    decode: (input) => {
      switch (input) {
        case 'packages':
        case SearchModel.ResultType.QuiltPackage:
          return SearchModel.ResultType.QuiltPackage
        case 'objects':
        case SearchModel.ResultType.S3Object:
          return SearchModel.ResultType.S3Object
        default:
          return SearchModel.DEFAULT_RESULT_TYPE
      }
    },
  },
)

// XXX: some sort of "strict" option for ignoring bad values instead of bailing
const RouteSearchParams = S.transform(Nav.SearchParams, SearchParamsSchema, {
  // parse qs
  decode: (input) => {
    const searchString = Eff.pipe(
      Eff.Record.get(input, 'q'),
      Eff.Option.flatMap(Eff.Array.last),
      Eff.Option.getOrElse(() => ''),
    )

    const buckets = Eff.pipe(
      Eff.Record.get(input, 'buckets'),
      Eff.Option.orElse(() => Eff.Record.get(input, 'b')),
      Eff.Option.flatMap(Eff.Array.last),
      Eff.Option.map(Eff.String.split(',')),
      Eff.Option.map(Eff.Array.sort(Eff.Order.string)),
      Eff.Option.getOrElse(Eff.Array.empty<string>),
      // TODO: validate bucket name format?
    )

    const order = Eff.pipe(
      Eff.Record.get(input, 'o'),
      Eff.Option.flatMap(Eff.Array.last),
      Eff.Option.getOrNull,
      S.decodeSync(OrderFromNullableString),
    )

    const resultType = Eff.pipe(
      Eff.Record.get(input, 't'),
      Eff.Option.orElse(() => Eff.Record.get(input, 'mode')),
      Eff.Option.flatMap(Eff.Array.last),
      Eff.Option.getOrNull,
      S.decodeSync(ResultTypeFromNullableString),
    )

    const params =
      resultType === SearchModel.ResultType.QuiltPackage
        ? S.decodeSync(PackageSearchParamsFromSearchParams)(input)
        : S.decodeSync(ObjectSearchParamsFromSearchParams)(input)

    return {
      searchString,
      buckets,
      order,
      params,
    }
  },

  encode: (input) => {
    const q = input.searchString ? [input.searchString] : []

    const buckets = Eff.pipe(
      Eff.Option.fromNullable(input.buckets),
      Eff.Option.filter(Eff.Array.isNonEmptyReadonlyArray),
      Eff.Option.map(Eff.Array.join(',')),
      Eff.Option.toArray,
    )

    const o = Eff.pipe(
      Eff.Option.fromNullable(input.order),
      Eff.Option.map(S.encodeSync(OrderFromNullableString)),
      Eff.Option.flatMap(Eff.Option.fromNullable),
      Eff.Option.toArray,
    )

    const t = Eff.pipe(
      Eff.Option.fromNullable(input.params.resultType),
      Eff.Option.map(S.encodeSync(ResultTypeFromNullableString)),
      Eff.Option.flatMap(Eff.Option.fromNullable),
      Eff.Option.toArray,
    )

    const filter =
      input.params.resultType === SearchModel.ResultType.QuiltPackage
        ? S.encodeSync(PackageSearchParamsFromSearchParams)(input.params)
        : S.encodeSync(ObjectSearchParamsFromSearchParams)(input.params)

    return {
      q,
      buckets,
      o,
      t,
      ...filter,
    }
  },
})

export default Nav.makeRoute({
  name: 'search',
  path: routes.search.path,
  description: 'Search page',
  searchParams: RouteSearchParams,
  waitForMarkers: ['searchResultsReady'],
})
