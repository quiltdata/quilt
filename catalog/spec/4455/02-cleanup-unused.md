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
- [ ] `catalog/app/containers/Bucket/Upload.tsx`
- [ ] `catalog/app/containers/Bucket/Download/BucketCodeSamples.tsx`
- [ ] `catalog/app/containers/Bucket/Download/BucketOptions.tsx`
- [ ] `catalog/app/containers/Bucket/Download/Button.tsx`
- [ ] `catalog/app/containers/Bucket/Download/OptionsTabs.tsx`

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

### Review Focus Areas

- [ ] Ensure no remaining references to deleted components
- [ ] Verify no breaking changes to existing functionality
- [ ] Confirm components being removed are truly unused

### PR Requirements

- [ ] PR title: "toolbar-02: Remove unused components for toolbar refactor"
- [ ] PR targets base branch: `4455-toolbar-01-shared-components`
- [ ] PR description explains cleanup purpose (copy this checklist into description)
- [ ] Link to decomposition spec in description
- [ ] All CI checks pass

### Pre-Merge Validation

- [ ] No compilation errors
- [ ] All existing functionality works as expected
- [ ] Codebase is cleaner with reduced complexity

## Success Criteria

- ✅ Unused components are completely removed
- ✅ No broken references or imports remain
- ✅ Existing functionality is unaffected
- ✅ Codebase complexity is reduced
