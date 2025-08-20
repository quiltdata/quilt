# Open Issues for Package Search Implementation

These questions should be resolved before implementing the GraphQL refactoring and package search functionality.

## 1. Authentication & Configuration

**Question**: How does the main `quilt3` package discover the GraphQL endpoint?

- Admin package likely has its own endpoint configuration
- Main package needs to find the same registry's GraphQL endpoint  
- Should this reuse existing `quilt3` registry configuration or need separate setup?

**Impact**: Affects how users configure and authenticate with the search API

> EP: This seems like a non-issue. Like the Admin module, we reuse the catalog config and authentication.

## 2. Dependency Management

**Question**: Should GraphQL dependencies be required or optional for main `quilt3` package?

- Adding `ariadne-codegen`, `httpx` etc. increases package size
- Could make search functionality optional with graceful degradation
- Need to decide on import strategy (`try/except` vs required)

**Impact**: Affects package installation, size, and user experience

> EP: These are build-time dependencies, not runtime, right?

## 3. Error Handling Patterns

**Question**: What exception types should search operations raise?

- Admin uses `QuiltAdminError`
- Main package has different exception hierarchy
- Should we create `QuiltSearchError` or reuse existing patterns?

**Impact**: Affects API consistency and user error handling experience

> EP: Check what the existing Search API uses. Is QuiltAdminError only for GraphQL issues?

## 4. Pagination UX

**Question**: What's the best pagination interface for users?

Current spec shows:
```python
search_more_packages(after=cursor)
```

Alternatives:
```python
# Iterator pattern
for page in search_results.pages():
    ...

# Built-in pagination  
search_packages(..., page=2)
```

**Impact**: Affects API usability and developer experience

> EP: `search_packages(..., page=2)` seems more ergonomic. Any prior art in this repo we can draw upon?

## 5. Testing Infrastructure

**Question**: How to handle GraphQL endpoint for tests?

- Need mock GraphQL server for integration tests
- Should we use existing test patterns from admin package?
- How to test against real endpoints in CI?

**Impact**: Affects test reliability, CI setup, and development workflow

> EP: This is presumably an existing issue, that is (should be) addressed in the enterprise repo, right?

## 6. Backward Compatibility

**Question**: Any concerns about adding GraphQL to main package?

- Impact on existing users who don't need search
- Package size and startup time implications
- Version compatibility between admin and main packages

**Impact**: Affects existing user experience and upgrade path

> EP: Does it actually add size to the admin package? How much? Most users install the whole package and sub-packages, so it shouldn't be visible.

---

## Priority

**Critical (must resolve before PR 1)**:
- Issues #1 (Authentication) and #2 (Dependencies)

**Important (must resolve before PR 2)**:  
- Issues #3 (Error Handling) and #4 (Pagination UX)

**Nice to have (can resolve during implementation)**:
- Issues #5 (Testing) and #6 (Backward Compatibility)