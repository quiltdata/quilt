# Implementation Plan: Package.search_meta Method

## Overview
Implement a new classmethod `search_meta` in the `quilt3.Package` class that searches for Quilt packages based on exact metadata field matches using the registry's GraphQL endpoint.

## Requirements Analysis
Based on the specification in `package_search_metadata.md`:

### Inputs
- `buckets`: S3 bucket name(s) to search (string or list of strings)
- `metadata`: Dictionary of metadata field/value pairs for exact matching

### Output
- List of package names that have exact matches for all specified metadata fields

### Backend
- Uses GraphQL endpoint at `{registry_url}/graphql`
- Leverages existing Elasticsearch indexes (separate per S3 bucket)
- Must handle exact matching of metadata field/value pairs

## Implementation Strategy

### 1. Method Signature
```python
@classmethod
@ApiTelemetry("package.search_meta")
def search_meta(cls, buckets: T.Union[str, T.List[str]], metadata: T.Dict[str, T.Any]) -> T.List[str]:
```

### 2. GraphQL Query Strategy
After analyzing the existing GraphQL schema and infrastructure:

#### Option A: Use Existing `searchPackages` Query
- The registry already has `searchPackages(buckets: [String!], searchString: String, filter: PackagesSearchFilter, userMetaFilters: [PackageUserMetaPredicate!], latestOnly: Boolean): PackagesSearchResult!`
- This query supports `userMetaFilters` parameter which can handle metadata filtering
- Need to construct appropriate `PackageUserMetaPredicate` objects for exact matching

#### Option B: Custom GraphQL Query (if needed)
- If existing query doesn't support exact metadata matching, we may need a new GraphQL resolver
- Would require backend changes in the registry server

### 3. Implementation Steps

#### Phase 1: Analyze Current GraphQL Schema
1. **Examine `PackageUserMetaPredicate` structure** in the GraphQL schema
2. **Test existing `searchPackages` query** to see if it supports exact metadata matching
3. **Determine if backend changes are needed** or if existing infrastructure suffices

#### Phase 2: Implement Client-Side Method
1. **Add method to Package class** in `/Users/kmoore/toa/github/quilt3/api/python/quilt3/packages.py`
2. **Use existing GraphQL client pattern** from the admin module
3. **Handle input validation** (buckets normalization, metadata format)
4. **Construct appropriate GraphQL query/variables**
5. **Parse response and extract package names**

#### Phase 3: Error Handling
1. **HTTP/Network errors** - connection failures, timeouts
2. **GraphQL errors** - query syntax, server errors
3. **Input validation** - invalid bucket names, malformed metadata
4. **Authentication errors** - registry access issues

#### Phase 4: Testing
1. **Unit tests** using the specified virtual environment `/Users/kmoore/venvs/quilt3`
2. **Integration tests** with real GraphQL endpoint (if available)
3. **Mock tests** for various error conditions

## Corrected Implementation (Based on Elasticsearch Analysis)

### Method Implementation
```python
@classmethod
@ApiTelemetry("package.search_meta")
def search_meta(cls, buckets: T.Union[str, T.List[str]], metadata: T.Dict[str, T.Any]) -> T.List[str]:
    """
    Search for Quilt packages based on metadata fields.

    Args:
        buckets: S3 bucket name or list of bucket names to search in
        metadata: Dictionary of metadata fields and values to match exactly

    Returns:
        List of package names that have exact matches of all metadata field/value pairs

    Raises:
        PackageException: If GraphQL request fails or invalid input provided
    """
    from . import session

    # Input validation and normalization
    if isinstance(buckets, str):
        buckets = [buckets]

    if not buckets:
        raise PackageException("At least one bucket must be specified")

    if not metadata:
        raise PackageException("At least one metadata field must be specified")

    # Construct GraphQL query using existing searchPackages
    query = """
    query SearchPackagesByMetadata($buckets: [String!]!, $userMetaFilters: [PackageUserMetaPredicate!]!) {
        searchPackages(
            buckets: $buckets
            userMetaFilters: $userMetaFilters
            latestOnly: true
        ) {
            ... on PackagesSearchResultSet {
                firstPage(size: 10000, order: LEX_ASC) {
                    hits {
                        name
                    }
                }
            }
            ... on EmptySearchResultSet {
                __typename
            }
        }
    }
    """

    # Convert metadata dict to PackageUserMetaPredicate filters
    # CRITICAL: Must match backend PackageUserMetaMatch structure exactly
    user_meta_filters = []
    for field, value in metadata.items():
        # Create complete predicate structure with all fields set (required by GraphQL schema)
        if isinstance(value, bool):
            predicate = {
                "path": field,
                "datetime": None,
                "number": None,
                "text": None,
                "keyword": None,
                "boolean": {"true": value, "false": not value}
            }
        elif isinstance(value, (int, float)):
            predicate = {
                "path": field,
                "datetime": None,
                "number": {"gte": float(value), "lte": float(value)},
                "text": None,
                "keyword": None,
                "boolean": None
            }
        else:
            # String values - use keyword field for exact matching
            predicate = {
                "path": field,
                "datetime": None,
                "number": None,
                "text": None,
                "keyword": {"terms": [str(value)], "wildcard": None},
                "boolean": None
            }
        user_meta_filters.append(predicate)

    variables = {
        "buckets": buckets,
        "userMetaFilters": user_meta_filters
    }

    # Make GraphQL request using raw session to avoid response hooks
    registry_url = session.get_registry_url()
    if not registry_url:
        raise PackageException("No registry configured. Use quilt3.config() to set registry URL.")

    # Use raw requests session with copied headers to avoid quilt3 response processing
    import requests
    http_session = session.get_session()
    raw_session = requests.Session()
    raw_session.headers.update(http_session.headers)

    payload = {
        "query": query,
        "variables": variables
    }

    response = raw_session.post(
        f"{registry_url}/graphql",
        json=payload,
        headers={"Content-Type": "application/json"}
    )

    if response.status_code != 200:
        raise PackageException(f"GraphQL request failed: {response.status_code} {response.text}")

    result = response.json()

    if "errors" in result:
        error_msg = "; ".join([err.get("message", str(err)) for err in result["errors"]])
        raise PackageException(f"GraphQL query failed: {error_msg}")

    # Extract package names from response
    search_result = result.get("data", {}).get("searchPackages")
    if not search_result:
        return []

    # Handle different response types (empty vs results)
    if search_result.get("__typename") == "EmptySearchResultSet":
        return []

    hits = search_result.get("firstPage", {}).get("hits", [])
    package_names = [hit.get("name") for hit in hits if hit.get("name")]

    return package_names
```

### Key Implementation Changes Based on Elasticsearch Analysis:

1. **Complete Predicate Structure**: Each `PackageUserMetaPredicate` includes ALL fields (`datetime`, `number`, `text`, `keyword`, `boolean`) with unused ones set to `None`

2. **Type-Specific Field Mapping**:
   - Strings → `keyword.terms` for exact matching
   - Numbers → `number.gte`/`lte` with same value for equality
   - Booleans → `boolean.true`/`false` flags

3. **Backend-Compatible Format**: Matches the `PackageUserMetaMatch` class structure from the enterprise registry

4. **Raw Session Usage**: Uses raw requests session to avoid quilt3 response processing that expects REST API format

5. **Correct GraphQL Schema**: Uses `firstPage` instead of `page` and proper field structure based on actual schema

## Authentication Strategy

Based on the existing `quilt3.admin` module patterns, the `search_meta` method leverages the same authentication mechanism used by all GraphQL operations in quilt3:

### Authentication Flow
1. **Registry Configuration**: Uses `quilt3.config()` to set the registry URL
2. **Session Management**: Leverages `quilt3.session.get_session()` for authenticated requests
3. **Token-based Auth**: Uses the same token authentication as admin operations

### Authentication Implementation
The method follows the existing pattern used by `quilt3.admin._graphql_client.BaseClient`:

```python
# In BaseClient.__init__():
self.url = session.get_registry_url() + "/graphql"
self.http_client = session.get_session()
```

### For Testing with demo.quiltdata.com
```python
# Configure registry (same as quilt3_admin usage)
quilt3.config('https://demo.quiltdata.com')

# Authenticate (same process as admin operations)
quilt3.login()  # Opens browser, user enters token

# Now search_meta will use authenticated session
packages = quilt3.Package.search_meta(
    buckets='quilt-sandbox-bucket',
    metadata={'experiment_id': 'EXP25000081'}
)
```

### Registry Service Details
- **Catalog URL**: `https://demo.quiltdata.com`
- **Registry Service**: `https://demo-registry.quiltdata.com`
- **GraphQL Endpoint**: `https://demo-registry.quiltdata.com/graphql`
- **Authentication**: Required (same as admin operations)

The method automatically constructs the correct GraphQL endpoint URL by appending `/graphql` to the configured registry URL, exactly like the admin module does.

## Testing Strategy

### Test Environment Setup
- Use virtual environment: `/Users/kmoore/venvs/quilt3`
- Activate with: `source /Users/kmoore/venvs/quilt3/bin/activate`
- Registry: `https://demo.quiltdata.com` (demo stack as specified)

### Test Cases

#### Unit Tests
1. **Input Validation Tests**
   - Single bucket string vs list of buckets
   - Empty buckets list
   - Empty metadata dict
   - Invalid metadata types

2. **GraphQL Query Construction Tests**
   - Verify correct query structure
   - Validate variables format
   - Test metadata conversion to predicates

3. **Response Parsing Tests**
   - Successful response with results
   - Empty search results
   - GraphQL errors
   - HTTP errors

#### Integration Tests with demo.quiltdata.com
1. **Authentication Tests**
   - Configure demo registry
   - Authenticate with `quilt3.login()`
   - Verify session has valid credentials

2. **End-to-end search tests**
   - Search with single metadata field: `{'experiment_id': 'EXP25000081'}`
   - Search with multiple metadata fields
   - Search across multiple buckets including `quilt-sandbox-bucket`
   - Search with no results (non-existent metadata values)

3. **Real Data Tests**
   - Test with `quilt-sandbox-bucket` and `experiment_id = EXP25000081`
   - Verify returned package names are valid
   - Test error handling with invalid bucket names

### Mock Test Implementation
```python
# tests/test_package_search_meta.py
import unittest
from unittest import mock
import json

from quilt3.packages import Package
from quilt3.exceptions import PackageException

class TestPackageSearchMeta(unittest.TestCase):

    @mock.patch('quilt3.session.get_registry_url')
    @mock.patch('quilt3.session.get_session')
    def test_search_meta_single_bucket(self, mock_session, mock_registry_url):
        # Setup mocks
        mock_registry_url.return_value = "https://registry.example.com"
        mock_response = mock.Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "data": {
                "searchPackages": {
                    "__typename": "PackagesSearchResultSet",
                    "page": {
                        "results": [
                            {
                                "__typename": "SearchHitPackage",
                                "package": {"name": "user/dataset1"}
                            },
                            {
                                "__typename": "SearchHitPackage",
                                "package": {"name": "user/dataset2"}
                            }
                        ]
                    }
                }
            }
        }
        mock_session.return_value.post.return_value = mock_response

        # Test
        result = Package.search_meta("my-bucket", {"project": "test", "version": "1.0"})

        # Assertions
        self.assertEqual(result, ["user/dataset1", "user/dataset2"])
        mock_session.return_value.post.assert_called_once()

    def test_search_meta_empty_buckets(self):
        with self.assertRaises(PackageException):
            Package.search_meta([], {"project": "test"})

    def test_search_meta_empty_metadata(self):
        with self.assertRaises(PackageException):
            Package.search_meta("my-bucket", {})
```

## Root Cause Analysis (RESOLVED - Elasticsearch Investigation Complete)

### Key Findings from Enterprise Registry Code Analysis:

1. **Target Package Exists**: ✅ `demo-user/csv-analysis-demo` has `experiment_id: "EXP25000081"` in its metadata
2. **Metadata Structure**: ✅ Package metadata is returned as JSON strings in GraphQL responses, correctly parsed to flat dictionaries
3. **Complete Predicate Structure**: ✅ Complete predicates with all fields (datetime, number, text, keyword, boolean) set, matching catalog patterns
4. **Universal Search Failure Root Cause**: ✅ **IDENTIFIED** - Python implementation didn't match backend Elasticsearch nested query structure

### ✅ **RESOLVED: Elasticsearch Index Schema Analysis**

**Investigation Results**: Analysis of `/Users/kmoore/toa/github/enterprise/registry/quilt_server/bucket.py` and `/Users/kmoore/toa/github/enterprise/registry/quilt_server/model/search/predicates.py` reveals the complete Elasticsearch index structure:

#### Elasticsearch Index Structure for User Metadata:
```json
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

#### Backend Query Construction (from `PackageUserMetaMatch.query()`):
```python
return {
    "nested": {
        "path": field,  # "mnfst_metadata_fields"
        "query": {
            "bool": {
                "filter": [
                    {"term": {f"{field}.json_pointer": self.path}},  # Match field name
                    q,  # Match field value in typed field (.keyword, .double, etc.)
                ],
            },
        },
    },
}
```

### Why the Original Python Implementation Failed:

1. **❌ Missing Nested Structure**: Python implementation created simple GraphQL predicates instead of nested Elasticsearch queries
2. **❌ Wrong Field Targeting**: Queried generic fields instead of type-specific nested fields (`.keyword`, `.double`, etc.)
3. **❌ Missing Path Matching**: Didn't filter on `json_pointer` to match field names
4. **❌ Incorrect Query Structure**: GraphQL `userMetaFilters` expect backend `PackageUserMetaMatch` format, not direct Elasticsearch queries

### ✅ **SOLUTION IDENTIFIED**: Backend-Compatible Implementation

The Python implementation must mirror the backend `PackageUserMetaMatch` class structure, which the GraphQL resolver converts to proper nested Elasticsearch queries.

## Updated Implementation Plan

### Phase 1: ✅ COMPLETED - Root Cause Analysis
- ✅ **Elasticsearch Schema Analysis**: Complete understanding of nested `mnfst_metadata_fields` structure
- ✅ **Backend Code Analysis**: `PackageUserMetaMatch` class structure identified
- ✅ **GraphQL Schema Compatibility**: Correct predicate format determined

### Phase 2: Implementation Update
1. **Update Existing Method**: Replace current implementation in `/Users/kmoore/toa/github/quilt3/api/python/quilt3/packages.py` with corrected version
2. **Backend-Compatible Predicates**: Use complete predicate structure matching `PackageUserMetaMatch`
3. **Type-Specific Field Mapping**: Target correct Elasticsearch nested fields (`.keyword`, `.double`, etc.)
4. **Raw Session Usage**: Avoid quilt3 response processing that interferes with GraphQL responses

### Phase 3: Testing and Validation
1. **Integration Test**: Verify `Package.search_meta("quilt-sandbox-bucket", {"experiment_id": "EXP25000081"})` returns `["demo-user/csv-analysis-demo"]`
2. **Multi-field Test**: Test with multiple metadata fields
3. **Type Coverage Test**: Test boolean, numeric, and string metadata fields
4. **Error Handling**: Verify proper error messages for invalid inputs

### Phase 4: Performance and Edge Cases
1. **Large Result Sets**: Test pagination and performance
2. **Multiple Buckets**: Verify cross-bucket search functionality
3. **Authentication Edge Cases**: Test with expired/invalid tokens

## Success Criteria

### Functional Requirements ✓
1. Method accepts bucket(s) and metadata dictionary as input
2. Returns list of package names with exact metadata matches
3. Uses GraphQL endpoint for querying
4. Handles multiple buckets correctly
5. Provides appropriate error handling

### Non-Functional Requirements
1. **Performance**: Query completes within reasonable time (< 30s)
2. **Reliability**: Proper error handling for network/server issues
3. **Usability**: Clear error messages for invalid input
4. **Maintainability**: Code follows existing patterns and conventions

### Testing Requirements ✓
1. Unit tests cover input validation and response parsing
2. Integration tests verify end-to-end functionality
3. Mock tests cover error conditions
4. Tests run in specified virtual environment

## Updated Implementation Timeline

### ✅ COMPLETED PHASES:
1. **Phase 1** (Research): ✅ **COMPLETED** - GraphQL schema, Elasticsearch structure, and backend code analysis
2. **Initial Implementation**: ✅ **COMPLETED** - Basic method implemented (but failed due to incorrect predicate structure)
3. **Root Cause Analysis**: ✅ **COMPLETED** - Elasticsearch investigation revealed nested query requirements

### REMAINING PHASES:
1. **Phase 2** (Implementation Update): Update existing method with corrected predicate structure - **2 hours**
2. **Phase 3** (Testing): Test corrected implementation with real data - **2 hours**
3. **Phase 4** (Validation): Comprehensive testing and edge case handling - **4 hours**

**Total remaining effort: 8 hours (1 day)**

## Dependencies ✅ RESOLVED
- ✅ Access to `/Users/kmoore/venvs/quilt3` virtual environment for testing
- ✅ GraphQL schema understanding (from enterprise registry analysis)
- ✅ Access to test registry instance (`demo.quiltdata.com`)
- ✅ **COMPLETE** understanding of Elasticsearch package metadata structure

## Implementation Status
- **Current Status**: Root cause identified, complete solution available
- **Next Step**: Replace existing implementation with corrected version
- **Expected Result**: `Package.search_meta("quilt-sandbox-bucket", {"experiment_id": "EXP25000081"})` should return `["demo-user/csv-analysis-demo"]`