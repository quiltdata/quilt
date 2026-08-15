import { useDebounce } from 'use-debounce'

import * as Model from 'model'
import * as GQL from 'utils/GraphQL'
import * as SearchUIModel from 'containers/Search/model'

import META_FACETS_QUERY from 'containers/Search/gql/PackageMetaFacets.generated'
import META_FACET_QUERY from 'containers/Search/gql/PackageMetaFacet.generated'
import FIRST_PAGE_PACKAGES_QUERY from 'containers/Search/gql/FirstPagePackages.generated'

// The state behind the predicate-rule authoring UI.
//
// Deliberately *not* built on SearchUIModel's own state container: every
// mutation there routes through `updateUrlState` -> `history.push`, which is
// right for a search page (the URL is the search) and wrong for a form (a
// draft is not navigation, and one push per keystroke is not a text field).
// What we do reuse is everything below that line -- the predicate ADTs, the
// `UserMetaFilters` accumulator, the facet queries, and the widgets -- so an
// author picks from the same vocabulary search exposes (A11).

export interface PredicateDraft {
  packageNamePattern: string
  entryPathPattern: string
  userMetaFilters: SearchUIModel.UserMetaFilters
}

export const EMPTY_DRAFT: PredicateDraft = {
  packageNamePattern: '',
  entryPathPattern: '',
  userMetaFilters: new SearchUIModel.UserMetaFilters(),
}

const trimToNull = (s: string): string | null => s.trim() || null

export function isEmpty(draft: PredicateDraft): boolean {
  return (
    !trimToNull(draft.packageNamePattern) &&
    !trimToNull(draft.entryPathPattern) &&
    !draft.userMetaFilters.filters.size
  )
}

// `null` for an untouched draft rather than a rule with three empty fields: an
// all-null predicate would match everything, which is never what an author who
// simply has not filled the form in yet meant.
export function toGQL(draft: PredicateDraft): Model.GQLTypes.PredicateRuleInput | null {
  if (isEmpty(draft)) return null
  return {
    packageNamePattern: trimToNull(draft.packageNamePattern),
    entryPathPattern: trimToNull(draft.entryPathPattern),
    userMetaFilters: draft.userMetaFilters.toGQL(),
  }
}

const EMPTY_SEARCH_FILTER: Model.GQLTypes.PackagesSearchFilter = {
  comment: null,
  entries: null,
  hash: null,
  modified: null,
  name: null,
  size: null,
  workflow: null,
}

export interface AvailableFacets {
  fetching: boolean
  facets: readonly SearchUIModel.PackageUserMetaFacet[]
  // The registry caps how many distinct userMeta paths it will enumerate; when
  // it does, the picker is showing a sample and has to say so.
  truncated: boolean
}

export function useAvailableFacets(buckets: readonly string[]): AvailableFacets {
  const query = GQL.useQuery(META_FACETS_QUERY, {
    searchString: null,
    buckets,
    filter: EMPTY_SEARCH_FILTER,
    latestOnly: true,
  })
  return GQL.fold(query, {
    data: ({ searchPackages: r }) =>
      r.__typename === 'PackagesSearchResultSet'
        ? {
            fetching: false,
            facets: r.stats.userMeta,
            truncated: r.stats.userMetaTruncated,
          }
        : { fetching: false, facets: [], truncated: false },
    fetching: () => ({ fetching: true, facets: [], truncated: false }),
    error: () => ({ fetching: false, facets: [], truncated: false }),
  })
}

export interface FacetExtents {
  fetching: boolean
  extents: SearchUIModel.Extents | undefined
}

// `usePackageUserMetaFacetExtents` with its two couplings removed: it reads the
// search model from context and asserts the filter is already active in that
// model's URL state. Neither holds for a draft, so path and type are passed in.
export function useFacetExtents(
  buckets: readonly string[],
  path: string,
  tag: SearchUIModel.KnownPredicate['_tag'],
): FacetExtents {
  const typeInfo = SearchUIModel.PackageUserMetaFacetTypeInfo[tag]

  const query = GQL.useQuery(
    META_FACET_QUERY,
    {
      searchString: null,
      buckets,
      filter: EMPTY_SEARCH_FILTER,
      latestOnly: true,
      path,
      type: typeInfo.inputType,
    },
    // Text and wildcard-keyword have no extents to fetch; asking anyway would
    // spend a round trip to be told so.
    { pause: !typeInfo.hasExtents },
  )

  if (!typeInfo.hasExtents) return { fetching: false, extents: undefined }

  return GQL.fold(query, {
    data: ({ searchPackages: r }) => {
      if (r.__typename !== 'PackagesSearchResultSet') {
        return { fetching: false, extents: undefined }
      }
      const facet = r.filteredUserMetaFacets[0]
      switch (facet?.__typename) {
        case 'NumberPackageUserMetaFacet':
          return { fetching: false, extents: facet.numberExtents }
        case 'DatetimePackageUserMetaFacet':
          return { fetching: false, extents: facet.datetimeExtents }
        case 'KeywordPackageUserMetaFacet':
          return { fetching: false, extents: facet.extents }
        default:
          return { fetching: false, extents: undefined }
      }
    },
    fetching: () => ({ fetching: true, extents: undefined }),
    error: () => ({ fetching: false, extents: undefined }),
  })
}

export interface PreviewHit {
  id: string
  bucket: string
  name: string
  hash: string
}

export interface PreviewState {
  fetching: boolean
  total: number | null
  hits: readonly PreviewHit[]
  // A rejected predicate reported as text, so the form can render it inline
  // instead of letting the union's error arm reach an error boundary.
  error: string | null
  // True when the draft names an entry-path pattern. The preview resolves
  // *packages*, and `PackagesSearchFilter` has no entry-path field, so the
  // count below is an upper bound in that case -- see `entryPathPattern` in
  // PredicateBuilder.tsx.
  approximate: boolean
}

const IDLE: PreviewState = {
  fetching: false,
  total: null,
  hits: [],
  error: null,
  approximate: false,
}

// Typing a wildcard should not put a query on the wire per keystroke; the
// widgets debounce their own edits, this covers the two free-text patterns.
const PREVIEW_DEBOUNCE_MS = 500

export function usePreview(
  buckets: readonly string[],
  draft: PredicateDraft,
): PreviewState {
  const [debounced] = useDebounce(draft, PREVIEW_DEBOUNCE_MS)

  const namePattern = trimToNull(debounced.packageNamePattern)
  const approximate = !!trimToNull(debounced.entryPathPattern)
  const empty = isEmpty(debounced)

  const query = GQL.useQuery(
    FIRST_PAGE_PACKAGES_QUERY,
    {
      searchString: null,
      buckets,
      filter: namePattern
        ? { ...EMPTY_SEARCH_FILTER, name: { terms: null, wildcard: namePattern } }
        : EMPTY_SEARCH_FILTER,
      userMetaFilters: debounced.userMetaFilters.toGQL(),
      latestOnly: true,
      ordering: null,
    },
    // An empty draft means "match everything"; previewing the whole catalog
    // teaches an author nothing and costs a full search.
    { pause: empty },
  )

  if (empty) return IDLE

  return GQL.fold(query, {
    data: ({ searchPackages: r }) => {
      switch (r.__typename) {
        case 'EmptySearchResultSet':
          return { fetching: false, total: 0, hits: [], error: null, approximate }
        case 'InvalidInput':
          return {
            fetching: false,
            total: null,
            hits: [],
            error: r.errors[0]?.message || 'Invalid predicate',
            approximate,
          }
        case 'OperationError':
          return {
            fetching: false,
            total: null,
            hits: [],
            error: r.message,
            approximate,
          }
        case 'PackagesSearchResultSet': {
          // `firstPage` carries its own error arms: an ordering the registry
          // cannot honor fails there, not on the outer union.
          const page = r.firstPage
          const hits =
            page.__typename === 'PackagesSearchResultSetPage'
              ? page.hits.map((h) => ({
                  id: h.id,
                  bucket: h.bucket,
                  name: h.name,
                  hash: h.hash,
                }))
              : []
          const error =
            page.__typename === 'InvalidInput'
              ? page.errors[0]?.message || 'Invalid predicate'
              : page.__typename === 'OperationError'
                ? page.message
                : null
          return { fetching: false, total: r.total, hits, error, approximate }
        }
        default:
          return { fetching: false, total: null, hits: [], error: null, approximate }
      }
    },
    fetching: () => ({
      fetching: true,
      total: null,
      hits: [],
      error: null,
      approximate,
    }),
    error: (e: Error) => ({
      fetching: false,
      total: null,
      hits: [],
      error: e.message,
      approximate,
    }),
  })
}
