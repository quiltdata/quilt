# Quilt Package Search UAT

Testing scripts for `quilt3.search_packages()` API functionality.

## Package Search API

```python
def search_packages(
    buckets=None,                    # List of bucket names to search
    search_string=None,              # Search query string  
    filter=None,                     # Dict of filters (e.g., date ranges)
    user_meta_filters=None,          # List of user metadata filters
    latest_only=False,               # If True, only latest version of each package
    size=30,                         # Max results per page
    order="BEST_MATCH"               # Sort order: BEST_MATCH, NEWEST, OLDEST, LEX_ASC, LEX_DESC
):
```

## Working Examples

Based on running tests against live data:

```python
import quilt3

# 1. Get all packages (empty search)
results = quilt3.search_packages(search_string="", size=5)
# Returns: ai2-semanticscholar-cord-19/CORD-19/2020-10-25, etc.

# 2. Search for specific term
results = quilt3.search_packages(search_string="data", size=5)  
# Returns: quilt-example/examples/interactive-data-dictionary (score: 10.35), etc.

# 3. Filter by bucket
results = quilt3.search_packages(buckets=["quilt-example"], size=3)
# Returns: akarve/many-revisions, etc.

# 4. Sort by newest first
results = quilt3.search_packages(search_string="data", order="NEWEST", size=3)
# Returns: quilt-ernest-staging/raw/test, etc.

# 5. Access results
for hit in results.hits:
    print(f"{hit.bucket}/{hit.name} (score: {hit.score})")
    print(f"  Modified: {hit.modified}")
```

## Test Scripts

Run these to verify functionality:

```bash
# Basic search and bucket filtering
python test_basic_search.py

# Test all parameters (ordering, size, filters, etc.)  
python test_filters_params.py

# Performance and pagination tests
python test_performance.py
```

## Key Parameters

- **buckets**: `["bucket1", "bucket2"]` - restrict search to specific buckets
- **search_string**: `"covid data"` - terms to search for  
- **size**: `10` - number of results (default: 30)
- **order**: `"NEWEST"` - sort by modification date, relevance, alphabetical
- **latest_only**: `True` - only show latest version of each package

## Prerequisites

- AWS credentials configured for S3 access
- Network access to Quilt registries  
- Python environment with `quilt3` installed