# Quilt Catalog Search Implementation Analysis

## Overview

The Quilt web catalog implements a sophisticated search system using TypeScript/React on the frontend and GraphQL for backend communication. The search functionality supports both S3 objects and Quilt packages with advanced metadata filtering capabilities.

## Architecture Overview

### Core Components

1. **Search Container** (`catalog/app/containers/Search/`)
   - Main search interface and state management
   - Supports two result types: S3Objects and QuiltPackages
   - Two view modes: List view and Table view

2. **Model Layer** (`model.ts`)
   - Central state management using React context
   - URL state synchronization
   - GraphQL query orchestration

3. **Predicate System** (`Predicates.ts`)
   - Type-safe filter definitions
   - Conversion between UI state, URL parameters, and GraphQL

4. **UserMetaFilters** (`UserMetaFilters.ts` and `model.ts`)
   - Dynamic metadata filtering for packages
   - Runtime filter discovery and application

## Search State Management

### SearchUrlState Structure

```typescript
interface PackagesSearchUrlState extends SearchUrlStateBase {
  resultType: ResultType.QuiltPackage
  filter: FilterStateForResultType<ResultType.QuiltPackage>
  userMetaFilters: UserMetaFilters
  latestOnly: boolean
}

interface SearchUrlStateBase {
  searchString: string | null
  buckets: readonly string[]
  order: ResultOrder
  view: View
}
```

### State Synchronization

The search state is synchronized across three layers:

1. **URL Parameters**: Human-readable search state in query string
2. **React State**: In-memory state for UI reactivity
3. **GraphQL Variables**: Backend-compatible format for queries

## Predicate System Deep Dive

### Supported Predicate Types

The catalog supports six predicate types for filtering:

```typescript
export const KNOWN_PREDICATES = [
  Boolean,       // true/false filters
  Datetime,      // date range filters
  KeywordEnum,   // exact term matching
  KeywordWildcard, // wildcard/fuzzy matching
  NumberRange,   // numeric range filters
  Text,          // full-text search
]
```

### Predicate Interface

Each predicate implements the `PredicateIO` interface:

```typescript
interface PredicateIO<Tag extends string, State extends JsonRecord> {
  tag: Tag                           // Unique identifier
  state: S.Schema<State>            // Type definition
  empty: State                      // Default/empty state
  str: S.Schema<State, string>      // URL serialization
}
```

### URL Parameter Encoding

Metadata filters are encoded in URL parameters using the format:
```
meta.{type_abbr}/{field_path}
```

Where `type_abbr` maps to predicate types:
- `d` → Datetime
- `n` → Number
- `t` → Text
- `e` → KeywordEnum
- `w` → KeywordWildcard
- `b` → Boolean

Example: `meta.e/experiment_id` for a KeywordEnum filter on `experiment_id`

## UserMetaFilters Implementation

### Core Class Structure

```typescript
export class UserMetaFilters {
  filters: Map<string, PredicateState<KnownPredicate>>

  // Convert to GraphQL format
  toGQL(): Model.GQLTypes.PackageUserMetaPredicate[] | null

  // URL parameter management
  toURLSearchParams(prefix: string): [string, string][]
  static fromURLSearchParams(params: URLSearchParams, prefix: string): UserMetaFilters
}
```

### GraphQL Conversion Process

The critical `toGQL()` method converts UI filter state to GraphQL predicates:

```typescript
toGQL(): Model.GQLTypes.PackageUserMetaPredicate[] | null {
  const predicates = Array.from(this.filters).reduce((acc, [path, predicate]) => {
    const gql = Predicates[predicate._tag].toGQL(predicate as any)
    if (!gql) return acc

    // Create complete predicate object with all fields
    const obj = {
      path,
      datetime: null,
      number: null,
      text: null,
      keyword: null,
      boolean: null,
      [UserMetaFilters.predicateMap[predicate._tag]]: gql,
    }
    return [...acc, obj]
  }, [] as Model.GQLTypes.PackageUserMetaPredicate[])

  return predicates.length ? predicates : null
}
```

### Predicate Type Mappings

```typescript
static predicateMap = {
  Datetime: 'datetime' as const,
  Number: 'number' as const,
  Text: 'text' as const,
  KeywordEnum: 'keyword' as const,
  KeywordWildcard: 'keyword' as const,  // Both keyword types map to 'keyword'
  Boolean: 'boolean' as const,
}
```

## GraphQL Schema and Backend Integration

### PackageUserMetaPredicate Structure

The GraphQL schema defines the expected predicate format:

```typescript
export interface PackageUserMetaPredicate {
  readonly path: Scalars['String']
  readonly datetime: Maybe<DatetimeSearchPredicate>
  readonly number: Maybe<NumberSearchPredicate>
  readonly text: Maybe<TextSearchPredicate>
  readonly keyword: Maybe<KeywordSearchPredicate>
  readonly boolean: Maybe<BooleanSearchPredicate>
}
```

### Individual Predicate Types

```typescript
// Keyword filters (both enum and wildcard)
interface KeywordSearchPredicate {
  readonly terms: Maybe<ReadonlyArray<Scalars['String']>>   // For exact matching
  readonly wildcard: Maybe<Scalars['String']>              // For pattern matching
}

// Numeric range filters
interface NumberSearchPredicate {
  readonly gte: Maybe<Scalars['Float']>   // Greater than or equal
  readonly lte: Maybe<Scalars['Float']>   // Less than or equal
}

// Boolean filters
interface BooleanSearchPredicate {
  readonly true: Maybe<Scalars['Boolean']>   // Match true values
  readonly false: Maybe<Scalars['Boolean']>  // Match false values
}

// Text search filters
interface TextSearchPredicate {
  readonly queryString: Scalars['String']   // Search query
}

// Date range filters
interface DatetimeSearchPredicate {
  readonly gte: Maybe<Scalars['Datetime']>   // After date
  readonly lte: Maybe<Scalars['Datetime']>   // Before date
}
```

## Predicate-to-GraphQL Conversion

### KeywordEnum → KeywordSearchPredicate

For exact term matching:
```typescript
toGQL: ({ terms }) =>
  terms.length
    ? ({ terms, wildcard: null } as KeywordSearchPredicate)
    : null
```

### KeywordWildcard → KeywordSearchPredicate

For pattern matching:
```typescript
toGQL: ({ wildcard, strict }) =>
  wildcard
    ? ({
        wildcard: strict ? wildcard : addMagicWildcardsKW(wildcard),
        terms: null,
      } as KeywordSearchPredicate)
    : null
```

### Number → NumberSearchPredicate

For exact numeric matching (used for exact values):
```typescript
toGQL: ({ _tag, ...state }) =>
  state.gte == null && state.lte === null
    ? null
    : (state as NumberSearchPredicate)
```

### Boolean → BooleanSearchPredicate

```typescript
toGQL: ({ _tag, ...state }) =>
  state.true || state.false ? (state as BooleanSearchPredicate) : null
```

## Query Execution Flow

### 1. State Construction

The search UI constructs a `SearchUrlState` object containing:
- `searchString`: Free-text search query
- `buckets`: Target S3 buckets
- `userMetaFilters`: Metadata filter instances
- `filter`: Built-in package filters (name, size, etc.)
- `latestOnly`: Whether to search only latest package versions

### 2. GraphQL Query Generation

The `useFirstPagePackagesQuery` hook converts state to GraphQL variables:

```typescript
function useFirstPagePackagesQuery(state: SearchUrlState) {
  return GQL.useQuery(FIRST_PAGE_PACKAGES_QUERY, {
    searchString: useMagicWildcardsQS(state.searchString),
    buckets: state.buckets,
    order: state.order,
    filter: PackagesSearchFilterIO.toGQL(state.filter),
    userMetaFilters: state.userMetaFilters.toGQL(),  // Key conversion
    latestOnly: state.latestOnly,
  })
}
```

### 3. GraphQL Query Structure

The actual GraphQL query (`FirstPagePackages.graphql`):

```graphql
query (
  $buckets: [String!]
  $searchString: String
  $filter: PackagesSearchFilter
  $userMetaFilters: [PackageUserMetaPredicate!]
  $latestOnly: Boolean!
  $order: SearchResultOrder
) {
  searchPackages(
    buckets: $buckets
    searchString: $searchString
    filter: $filter
    userMetaFilters: $userMetaFilters
    latestOnly: $latestOnly
  ) {
    # ... result structure
  }
}
```

## Key Implementation Details

### Complete Predicate Structure Requirement

**Critical**: Every `PackageUserMetaPredicate` must include ALL predicate type fields, with unused ones set to `null`. This matches the Elasticsearch indexing structure:

```typescript
// CORRECT - Complete structure
{
  path: "experiment_id",
  datetime: null,
  number: null,
  text: null,
  keyword: { terms: ["EXP25000081"], wildcard: null },
  boolean: null
}

// INCORRECT - Incomplete structure
{
  path: "experiment_id",
  keyword: { terms: ["EXP25000081"] }
}
```

### Magic Wildcards

The catalog automatically adds wildcards to improve search usability:

- `addMagicWildcardsQS()`: Adds wildcards to free-text queries
- `addMagicWildcardsKW()`: Adds wildcards to keyword filters (unless strict mode)

### Filter Discovery and Faceting

The catalog dynamically discovers available metadata fields using separate GraphQL queries:

- `PackageMetaFacets`: Discovers all available metadata fields
- `PackageMetaFacet`: Gets value distribution for specific fields
- `PackageMetaFacetsFind`: Server-side facet filtering

## Debugging and Troubleshooting

### Common Issues

1. **Incomplete Predicate Structure**: Missing required `null` fields for unused predicate types
2. **Type Mismatches**: Using wrong predicate type for data (e.g., Text instead of KeywordEnum)
3. **URL Encoding**: Incorrect parameter format in URL state
4. **Magic Wildcards**: Unexpected wildcard behavior in strict matching

### Debugging Tools

The catalog provides several debugging mechanisms:
- URL state inspection via query parameters
- GraphQL query logging in browser dev tools
- Filter state visualization in UI
- Server-side facet discovery queries

## Differences from Python Implementation

### Key Discrepancies Found

1. **Predicate Structure**: The Python implementation was missing the complete predicate structure with all fields set to `null`

2. **Type Handling**: The catalog uses different approaches for exact vs. fuzzy matching through KeywordEnum vs. KeywordWildcard

3. **Magic Wildcards**: The catalog automatically adds wildcards for user-friendly searching, which may affect exact matching

4. **Field Discovery**: The catalog uses dynamic facet discovery, while Python implementation assumes field knowledge

### Recommended Python Fixes

Based on this analysis, the Python `search_meta` method should:

1. **Use Complete Predicate Structure**: Include all predicate type fields with `null` for unused ones
2. **Choose Appropriate Predicate Types**: Use `KeywordEnum` for exact matching, not `KeywordWildcard`
3. **Handle Type Coercion**: Properly convert Python types to GraphQL-expected formats
4. **Consider Magic Wildcards**: Account for potential wildcard behavior in string matching

## Elasticsearch Index Structure and User Metadata Encoding

### Index Schema Definition

The Elasticsearch package index is created with a specific schema defined in `/Users/kmoore/toa/github/enterprise/registry/quilt_server/bucket.py`. The key structure for user metadata is:

```typescript
"mnfst_metadata_fields": {
  "type": "nested",
  "properties": {
    "json_pointer": {"type": "keyword"},     // Field path (e.g., "experiment_id")
    "type": {"type": "keyword"},            // Data type ("keyword", "double", "date", "boolean", "text")
    "keyword": {"type": "keyword"},         // String values indexed here
    "text": {"type": "text"},              // Full-text searchable values
    "date": {"type": "date"},             // Date values
    "boolean": {"type": "boolean"},       // Boolean values
    "double": {"type": "double"},         // Numeric values (int/float)
  }
}
```

### Metadata Field Encoding Process

When packages are indexed, user metadata is decomposed into individual fields within the nested `mnfst_metadata_fields` structure:

1. **Field Path**: The JSON path to the metadata field (e.g., `"experiment_id"`)
2. **Type Detection**: Values are analyzed and assigned an Elasticsearch type
3. **Type-Specific Storage**: Values are stored in the appropriate typed field:
   - Strings → `keyword` field for exact matching
   - Numbers → `double` field for range queries
   - Booleans → `boolean` field
   - Dates → `date` field
   - Text → `text` field for full-text search

### Query Construction for User Metadata Filters

The backend `PackageUserMetaMatch` class in `/Users/kmoore/toa/github/enterprise/registry/quilt_server/model/search/predicates.py` shows how metadata queries must be constructed:

```python
def query(self, field: str) -> T.Optional[dict]:
    p = self._get_predicate()
    if not p:
        return None
    type_ = self._type_map[type(p)]  # Maps to ES field type
    q = p.query(f"{field}.{type_}")  # Query the typed field
    if not q:
        return None
    return {
        "nested": {
            "path": field,  # "mnfst_metadata_fields"
            "query": {
                "bool": {
                    "filter": [
                        {"term": {f"{field}.json_pointer": self.path}},  # Match field name
                        q,  # Match field value in typed field
                    ],
                },
            },
        },
    }
```

### Critical Implementation Requirements

1. **Nested Query Structure**: All user metadata queries must use nested queries on `mnfst_metadata_fields`

2. **Dual Filtering**: Each metadata query requires TWO filters:
   - `json_pointer` term match for the field name
   - Type-specific value match in the appropriate typed field

3. **Type Mapping**: The GraphQL predicate types must map to Elasticsearch field types:
   - GraphQL `keyword` → ES `mnfst_metadata_fields.keyword`
   - GraphQL `number` → ES `mnfst_metadata_fields.double`
   - GraphQL `boolean` → ES `mnfst_metadata_fields.boolean`
   - GraphQL `text` → ES `mnfst_metadata_fields.text`
   - GraphQL `datetime` → ES `mnfst_metadata_fields.date`

### Why the Python Implementation Failed

The original Python `search_meta` implementation failed because it constructed incomplete GraphQL predicates that didn't properly target the nested Elasticsearch structure. The backend registry code reveals that:

1. **Missing Nested Structure**: User metadata filters must query the nested `mnfst_metadata_fields` path
2. **Incorrect Field Targeting**: Values must be queried in type-specific fields (`.keyword`, `.double`, etc.)
3. **Missing Path Matching**: Each query must include both field name and value filtering

### Corrected Python Implementation Requirements

Based on the Elasticsearch schema analysis, the Python `search_meta` method must:

1. **Use Backend Predicate Classes**: Leverage the existing `PackageUserMetaMatch` class structure
2. **Target Correct ES Fields**: Query `mnfst_metadata_fields.keyword` for string values, not generic fields
3. **Use Nested Queries**: All metadata filters must be wrapped in nested query structure
4. **Match Backend Logic**: Follow the exact same query construction pattern as the registry backend

## Registry Version-Specific Limitations

### Demo Registry (demo.quiltdata.com) Constraints

Analysis of the demo registry codebase reveals important operational limits that affect query behavior:

#### Page Size Limitations

The demo registry enforces strict page size limits defined in `/Users/kmoore/toa/github/enterprise/registry/quilt_server/model/search/base.py`:

```python
MAX_PAGE_SIZE = 100  # Maximum results per query page
```

**Impact**: GraphQL queries with `size > 100` will result in HTTP 500 "Internal Server Error" responses. This explains why test queries using `size: 10000` failed, while smaller page sizes work correctly.

**Python Implementation Requirement**: The `search_meta` method must use page sizes ≤ 100 when querying demo.quiltdata.com or other registries with similar limits.

#### Error Manifestation

Large page size errors appear as:
- HTTP Status: `500 Internal Server Error`
- Response: Generic server error without specific pagination details
- No clear indication that page size is the root cause

**Recommended Fix**: Use `size: 100` or smaller in GraphQL queries, and implement pagination if more results are needed.

### Version Compatibility Notes

The demo registry runs older code that may have different:
- GraphQL schema versions
- Query optimization strategies
- Resource limits beyond page sizing

**Testing Strategy**: Always verify query behavior against the specific registry version being targeted, as limits may vary between deployments.

## Conclusion

The Quilt catalog implements a sophisticated metadata filtering system with strong type safety and URL synchronization. The key insight is that successful metadata filtering requires complete predicate structures that match the Elasticsearch indexing schema, where each predicate must specify all possible filter types with unused ones set to `null`.

**Most critically**, the Elasticsearch analysis reveals that user metadata is stored in a nested structure (`mnfst_metadata_fields`) where each field value is indexed under its detected type (keyword, double, boolean, etc.). This requires specialized nested queries that target both the field path (`json_pointer`) and the type-specific value field.

**Registry Constraints**: Production registries like demo.quiltdata.com enforce operational limits (e.g., `MAX_PAGE_SIZE = 100`) that must be respected in GraphQL queries to avoid server errors.

The TypeScript implementation provides a robust model for how the Python `search_meta` method should construct its GraphQL queries to ensure compatibility with the backend search infrastructure, but the actual query construction must match the backend registry's `PackageUserMetaMatch` predicate system that properly targets the nested Elasticsearch structure.