# Implementation Tasks: Enhanced Qurator Context System

## Instructions

Follow these tasks in order (unless requested otherwise). Each task builds on the previous ones.
Stop after each task, double-check your work, request approval from the user before proceeding.
Check off each task in this document as you complete it.
Add git checkpoints when requested by the user.

## Conventions

When implementing, follow the existing patterns in the codebase:

- Use Effect library for async operations
- Use `Assistant.Context.LazyContext` for context providers
- Format context as XML using `utils/XML`
- Add appropriate markers for context readiness

## Task 1: Create Core Context File Loading Module

### 1.1 Create ContextFiles.ts
**File:** `app/components/Assistant/Model/ContextFiles.ts`

- [x] Import required dependencies:
  - `Effect` from 'effect'
  - `S3` from AWS SDK
  - `XML` utilities
- [x] Define interfaces:
  - `ContextFileContent` with path, content, truncated fields
  - `ContextFileOptions` with max size, timeout
- [x] Implement `loadContextFile(s3, bucket, path)`:
  - Use `s3.getObject()` to fetch README.md
  - Handle 404 errors gracefully (return null)
  - Truncate content if > MAX_CONTEXT_FILE_SIZE (100KB)
  - Return content with metadata
- [x] Implement `buildPathChain(currentPath, stopAt?)`:
  - Split path by '/' separator
  - Build array from current to root
  - Stop at specified path if provided
  - Example: 'a/b/c' → ['a/b/c', 'a/b', 'a']
- [x] Implement `loadContextFileHierarchy(s3, bucket, currentPath, stopAt?)`:
  - Build path chain using `buildPathChain`
  - Load README.md from each path in parallel
  - Filter out nulls (missing files)
  - Return array ordered by specificity
- [x] Implement `buildPackagePathChain(packagePath, packageRoot)`:
  - Build chain within package first
  - Add package as child of bucket
  - Exclude bucket root (handled separately)
- [x] Export all functions and types
- [x] Add `ContextFileAttributes` interface with scope, bucket, packageName
- [x] Update `formatContextFileAsXML` to accept optional attributes

## Task 2: Create Bucket Root Context Provider

### 2.1 Create Bucket AssistantContext
**File:** `app/containers/Bucket/AssistantContext.tsx`

- [x] Import dependencies:
  - `Assistant` from 'components/Assistant'
  - `ContextFiles` module
  - `AWS` for S3 access
  - `XML` utilities
- [x] Create `BucketContext` using `Assistant.Context.LazyContext`:
  - Accept props: `{ bucket }`
  - Load README.md from bucket root using `loadContextFile`
  - Format as XML with path="/README.md"
  - Return messages array and marker `bucketContextFilesReady`
- [x] Export `BucketContext`

### 2.2 Integrate into Bucket component
**File:** `app/containers/Bucket/Bucket.tsx`

- [x] Import `AssistantContext` from './AssistantContext'
- [x] Add `<AssistantContext.BucketContext>` component
- [x] Pass bucket name as props
- [x] Place appropriately in component tree

## Task 3: Enhance Directory Context

### 3.1 Update DirAssistantContext
**File:** `app/containers/Bucket/DirAssistantContext.ts`

- [x] Import `ContextFiles` module
- [x] Add new context provider `DirContextFiles`:
  - Accept props: `{ bucket, path }`
  - Use `loadContextFileHierarchy` to load README chain
  - Stop at bucket root (don't reload root README)
  - Format each file as XML `<context-file>`
  - Add marker `dirContextFilesReady`
- [x] Export both `ListingContext` and `DirContextFiles`

### 3.2 Integrate into Dir component
**File:** `app/containers/Bucket/Dir.tsx`

- [x] Import updated `AssistantContext`
- [x] Get S3 client using `AWS.S3.use()` (in the context itself)
- [x] Add `<AssistantContext.DirContextFiles>` component
- [x] Pass bucket, path as props
- [x] Place alongside existing `ListingContext`

## Task 4: Enhance File Context

### 4.1 Update File AssistantContext
**File:** `app/containers/Bucket/File/AssistantContext.ts`

- [x] Import `ContextFiles` module
- [x] Create `FileContextFiles` provider:
  - Accept props: `{ bucket, path }`
  - Get parent directory from file path
  - Use `loadContextFileHierarchy` for parent dir
  - Format as XML context messages
  - Add marker `fileContextFilesReady`
- [x] Export all context providers

### 4.2 Integrate into File component
**File:** `app/containers/Bucket/File/File.js`

- [x] Import updated `AssistantContext`
- [x] Add `<AssistantContext.FileContextFiles>` component
- [x] Pass bucket, path (file path)
- [x] Place alongside existing version contexts

## Task 5: Create Package Context Providers

### 5.1 Create Package AssistantContext
**File:** `app/containers/Bucket/PackageTree/AssistantContext.tsx`

- [x] Import required dependencies
- [x] Create `PackageMetadataContext`:
  - Accept package name, hash, manifest data
  - Format package info as XML
  - Include: name, hash, created date, message
  - Add marker `packageMetadataReady`
- [x] Create `PackageRootContext`:
  - Load README.md from package root using LogicalKeyResolver
  - Format as XML with full path
  - Add marker `packageContextFilesReady`
- [x] Create `PackageDirContext`:
  - Load README hierarchy for package directories
  - Excludes root README (handled by PackageRootContext)
  - Uses LogicalKeyResolver to resolve virtual paths to physical S3 keys
  - Add marker `packageDirContextFilesReady`
- [x] Export all context providers

### 5.2 Integrate into PackageTree
**File:** `app/containers/Bucket/PackageTree/PackageTree.tsx`

- [x] Import `AssistantContext` from './AssistantContext'
- [x] Place contexts appropriately:
  - `PackageMetadataContext` at PackageTree level (outside ResolverProvider)
  - `PackageRootContext` inside ResolverProvider (needs resolver)
  - `PackageDirContext` in DirDisplay and FileDisplay components
- [x] For DirDisplay:
  - Add `PackageDirContext` with current path
- [x] For FileDisplay:
  - Add `PackageDirContext` with parent directory path
- [x] Pass appropriate props to each context

### 5.3 Add Context Scope Attributes (Additional Enhancement)
- [x] Update `formatContextFileAsXML` to accept attributes
- [x] Add scope="bucket" to all bucket context files
- [x] Add scope="package" to all package context files
- [x] Include bucket attribute on all context files
- [x] Include package-name attribute on package context files

### 5.4 Expose Package Metadata (userMeta)
- [x] Extend Revision.graphql query to include userMeta, workflow, totalEntries
- [x] Add modified field to all package queries for cache key consistency
- [x] Update PackageMetadataContext to receive revision data as props
- [x] Pass revision data through component hierarchy
- [x] Fix infinite loop issue caused by urql cache key instability

### 5.5 Split Package Metadata Context (2025-09-25)
- [x] Split package metadata into two separate XML tags:
  - `<package-info>`: System metadata (bucket, name, hash, modified, message, workflow, totalEntries, totalBytes)
  - `<package-metadata>`: User metadata (userMeta only, when present)
- [x] Update PackageMetadataContext to emit multiple messages
- [x] Maintain backward compatibility with existing marker `packageMetadataReady`

## Task 6: Testing and Validation

### 6.1 Manual Testing Checklist
- [ ] Navigate to bucket root, verify bucket README loads
- [ ] Navigate to subdirectory, verify README hierarchy
- [ ] Open a file, verify parent directory READMEs load
- [ ] Browse package root, verify metadata and README
- [ ] Browse package subdirectory, verify README chain
- [ ] Test with missing README files (should handle gracefully)
- [ ] Test with large README file (should truncate)

### 6.2 Verify Context Markers
- [ ] Check Qurator DevTools for context markers:
  - `bucketContextFilesReady`
  - `dirContextFilesReady`
  - `fileContextFilesReady`
  - `packageMetadataReady`
  - `packageContextFilesReady`
  - `packageDirContextFilesReady`

### 6.3 Edge Cases
- [ ] Empty directories (no README)
- [ ] Deep directory nesting
- [ ] Package at bucket root
- [ ] README files with special characters / prompt injection
- [ ] Network errors during loading

## Task 7: Error Handling and Optimization

### 7.1 Add Error Boundaries
- [ ] Wrap context providers in error boundaries
- [ ] Log errors but don't break UI
- [ ] Provide fallback empty context on errors

### 7.2 Performance Optimization
- [ ] Verify parallel loading of multiple READMEs
- [ ] Check that truncation works correctly
- [ ] Ensure no duplicate loads of same README

## Task 8: De-emphasize Tool Call Message UI

### 8.1 Visual Treatment
- [x] Reduce visual prominence of tool call message boxes
  - Fainter background color (grey[600])
  - Added hover effect (opacity 0.5 -> 1.0)
  - Maintain readability while being less distracting

### 8.2 Replace Labels with Icons
- [x] Replace "Tool Use" text label with Build icon
- [x] Replace status text with icons (progress/success/error)
  - Progress: CircularProgress spinner (14px)
  - Success: CheckCircleOutline icon
  - Error: ErrorOutline icon

### 8.3 Collapse Tool Details
- [x] Hide JSON details under collapsible spoiler/accordion
- [x] Default to collapsed state
- [x] Click header to toggle expansion
- [x] Use Material-UI Collapse for smooth animation
- [x] Preserve details for debugging purposes

### 8.4 Code Refactoring
- [x] Extract reusable ToolMessage component
- [x] Consolidate tool message rendering logic
- [x] Use dedicated styles instead of inline styling

## Task 9: Add AGENTS.md Support with Size and Count Limits

### 9.1 Update ContextFiles Module
**File:** `app/components/Assistant/Model/ContextFiles.ts`

- [x] Add CONTEXT_FILE_NAMES = ['README.md', 'AGENTS.md']
- [x] Update MAX_CONTEXT_FILE_SIZE from 100_000 to 10_000 (10KB)
- [x] Add MAX_NON_ROOT_FILES = 10 constant
- [x] Update `loadContextFile` to accept filename parameter
- [x] Update `loadContextFileHierarchy` to:
  - Load both README.md and AGENTS.md at each level
  - Apply 10 file limit for non-root files
  - Prioritize closer files over distant ones
  - Exclude root files from count limit

### 9.2 Update Bucket Context
**File:** `app/containers/Bucket/AssistantContext.tsx`

- [x] Load both README.md and AGENTS.md from bucket root
- [x] Apply 10KB truncation limit

### 9.3 Update Directory Context
**File:** `app/containers/Bucket/DirAssistantContext.ts`

- [x] Load both README.md and AGENTS.md in hierarchy
- [x] Apply 10 file limit (excluding root)
- [x] Prioritize by proximity

### 9.4 Update File Context
**File:** `app/containers/Bucket/File/AssistantContext.ts`

- [x] Load both README.md and AGENTS.md from parent hierarchy
- [x] Apply limits and prioritization

### 9.5 Update Package Contexts
**File:** `app/containers/Bucket/PackageTree/AssistantContext.tsx`

- [x] Update PackageRootContext to load both files
- [x] Update PackageDirContext to load both files with limits
- [x] Apply proximity prioritization

### 9.6 Testing
- [ ] Verify AGENTS.md files load correctly
- [ ] Test 10KB truncation
- [ ] Verify 10 file limit works
- [ ] Confirm root files always included
- [ ] Test proximity prioritization

## Completion Checklist

- [ ] All context files load correctly
- [ ] Markers are set appropriately
- [ ] No console errors
- [ ] Assistant has access to context
- [ ] Performance is acceptable
- [ ] Error cases handled gracefully

## Task 10: Code Quality Refactoring

### 10.1 Extract Common Loading Pattern
**File:** `app/components/Assistant/Model/ContextFiles.ts`

- [ ] Create `useContextFileLoader` custom hook
- [ ] Extract common useState, useEffect, useMemo pattern
- [ ] Handle loading states and error cases uniformly
- [ ] Return standardized result shape: `{ files, loading, error }`

### 10.2 Refactor Context Providers
**Files:** All `AssistantContext.tsx` files

- [ ] Replace duplicate loading code with useContextFileLoader hook
- [ ] Maintain existing API contract and behavior
- [ ] Verify no regressions in functionality
- [ ] Test all context markers still work correctly

### 10.3 Consolidate Package Context Logic
**File:** `app/containers/Bucket/PackageTree/AssistantContext.tsx`

- [ ] Extract shared logic between PackageRootContext and PackageDirContext
- [ ] Create helper functions for LogicalKeyResolver operations
- [ ] Reduce code duplication by ~50%
- [ ] Consider shared base implementation with specialized parameters

### 10.4 Standardize Error Handling
**File:** `app/components/Assistant/Model/ContextFiles.ts`

- [ ] Remove unnecessary console.error/console.debug statements
- [ ] Log only critical errors that require debugging
- [ ] Use consistent error handling pattern across all contexts
- [ ] Return empty arrays/null gracefully without logging for expected cases (404s)

## Reference Files

Key files to reference during implementation:
- **Context pattern:** `app/containers/Bucket/DirAssistantContext.ts`
- **S3 operations:** `app/containers/Bucket/requests/object.ts`
- **XML formatting:** `app/utils/XML.ts`
- **Effect usage:** `app/containers/Bucket/File/AssistantContext.ts`
- **Component integration:** `app/containers/Bucket/Dir.tsx` (line 245)
