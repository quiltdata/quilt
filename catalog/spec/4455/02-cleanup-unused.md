<!-- markdownlint-disable line-length -->
# PR #2: Cleanup - Remove Unused Components

**Branch**: `4455-toolbar-02-cleanup-unused`  
**Risk Level**: Low  
**Dependencies**: PR #1 (merges into `4455-toolbar-01-shared-components` branch)  
**Estimated Size**: ~10 files, +0/-600 lines

## Objective

Remove deprecated and unused components to reduce codebase complexity before implementing new toolbar architecture.

## Files to Remove

- [ ] `catalog/app/containers/Admin/Sync.tsx`
- [ ] `catalog/app/containers/Bucket/Download/BucketCodeSamples.tsx`
- [ ] `catalog/app/containers/Bucket/Download/BucketOptions.tsx`
- [ ] `catalog/app/containers/Bucket/Download/Button.tsx`
- [ ] `catalog/app/containers/Bucket/Download/OptionsTabs.tsx`

## Files NOT to Remove

- `catalog/app/containers/Bucket/Upload.tsx` - **REQUIRED** by `PackageCreationForm.tsx` for Electron package uploads (`useUploadPackage()` function)

## Implementation Checklist

### Setup

- [ ] Create branch `4455-toolbar-02-cleanup-unused` from `4455-toolbar-01-shared-components`
- [ ] Cherry-pick deletion commits from `add-files-to-bucket`
- [ ] Single commit with message: "refactor: Remove unused toolbar components"

### Code Quality

- [ ] Verify no remaining imports/references to deleted components
- [ ] Update any import statements that reference removed files
- [ ] Fix any TypeScript compilation errors
- [ ] No broken functionality after removals

### Testing

- [ ] All existing tests still pass
- [ ] No test files reference deleted components
- [ ] Remove any tests that only tested deleted components

### Local Testing (REQUIRED before pushing)

- [ ] Run `npm test` locally and verify all tests pass
- [ ] Run `npm run build` locally and verify TypeScript compilation succeeds
- [ ] Run `npm run lint` locally and fix any linting errors
- [ ] Test affected components manually in browser if applicable
- [ ] Verify no console errors when running the application locally

### Review Focus Areas

- [ ] Ensure no remaining references to deleted components
- [ ] Verify no breaking changes to existing functionality
- [ ] Confirm components being removed are truly unused

### PR Workflow

- [ ] Push branch: `git push -u origin 4455-toolbar-02-cleanup-unused`
- [ ] Create **DRAFT** PR with title: "toolbar-02: Remove unused components for toolbar refactor"
- [ ] PR targets base branch: `4455-toolbar-01-shared-components`
- [ ] Copy this checklist into PR description
- [ ] Link to decomposition spec in description
- [ ] Mark PR as **ready for review** only after all CI checks pass and comments are resolved

### CI & Review Cycle

#### CRITICAL: Complete this entire cycle - do not stop until PR is merge-ready

- [ ] Monitor CI until all checks complete (wait for pending checks)
- [ ] Address any failing CI checks using CI feedback (NOT local linter)  
- [ ] Fix any failing tests reported by CI
- [ ] Address PR review comments and resolve them using GraphQL API
- [ ] Push fixes and repeat until ALL checks pass
- [ ] Verify PR is in merge-ready state (all green checkmarks)
- [ ] Annotate this checklist with any issues encountered for future improvement

### Pre-Merge Validation

- [ ] All CI checks pass
- [ ] All review comments resolved
- [ ] Code review completed and approved
- [ ] No compilation errors
- [ ] All existing functionality works as expected
- [ ] Codebase is cleaner with reduced complexity
- [ ] Ready for merge into next phase

## Success Criteria

- ✅ Unused components are completely removed
- ✅ No broken references or imports remain
- ✅ Existing functionality is unaffected
- ✅ Codebase complexity is reduced

## Lessons Learned

**Critical Issue Discovered:** The original spec incorrectly listed `Upload.tsx` for removal. This file is **not unused** - it contains the `useUploadPackage()` function that is required by `PackageCreationForm.tsx` for Electron package creation functionality.

**Root Cause:** Insufficient dependency analysis during spec creation. The file appeared unused at surface level but was actually a critical import dependency.

**Resolution:**

- Restored `Upload.tsx` from the 01-shared-components branch
- Fixed import path in `PackageCreationForm.tsx` from `'./Uploads'` to `'../Upload'`
- Updated spec to explicitly document what should NOT be removed

**Prevention:** Always run dependency analysis (`grep -r "import.*Upload"`) before marking files as unused for removal.
