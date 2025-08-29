<!-- markdownlint-disable line-length -->
# PR #3: Core Architecture - Base Toolbar Structure

**Branch**: `4455-toolbar-03-base-structure`  
**Risk Level**: Medium  
**Dependencies**: PR #2 (merges into PR #2 branch)  
**Estimated Size**: ~12 files, +400/-100 lines

## Objective

Establish the new toolbar architecture with empty/minimal implementations. This creates the structure without implementing specific features.

## Files to Cherry-Pick

- [ ] `catalog/app/containers/Bucket/Toolbar/Toolbar.tsx` (new)
- [ ] `catalog/app/containers/Bucket/Toolbar/Toolbar.spec.tsx` (new)
- [ ] `catalog/app/containers/Bucket/Dir/Toolbar/Toolbar.tsx` (new)
- [ ] `catalog/app/containers/Bucket/Dir/Toolbar/Toolbar.spec.tsx` (new)
- [ ] `catalog/app/containers/Bucket/File/Toolbar/Toolbar.tsx` (new)
- [ ] `catalog/app/containers/Bucket/File/Toolbar/Toolbar.spec.tsx` (new)
- [ ] Basic integration into `Dir.tsx` and `File.js`

## Implementation Checklist

### Setup

- [ ] Create branch `4455-toolbar-03-base-structure` from `4455-toolbar-02-cleanup-unused`
- [ ] Cherry-pick architecture files from `add-files-to-bucket`
- [ ] Single commit with message: "feat: Add base toolbar architecture structure"

### Code Quality

- [ ] Verify component composition approach is sound
- [ ] Check integration points with existing components
- [ ] Ensure TypeScript interfaces are well-defined
- [ ] Confirm architecture supports planned features

### Testing

- [ ] Base toolbar components have unit tests
- [ ] Integration tests for component mounting
- [ ] Test structure supports future feature additions
- [ ] All existing tests continue to pass

### Review Focus Areas

- [ ] Architecture pattern - is it extensible and maintainable?
- [ ] Component composition approach - clean separation of concerns?
- [ ] Integration points - minimal impact on existing code?
- [ ] Test structure - supports future feature testing?

### PR Requirements

- [ ] PR title: "toolbar-03: Add base toolbar architecture structure"
- [ ] PR targets base branch: `4455-toolbar-02-cleanup-unused`
- [ ] PR description explains architecture decisions (copy this checklist into description)
- [ ] Link to decomposition spec in description
- [ ] All CI checks pass
- [ ] Thorough architecture review completed

### Pre-Merge Validation

- [ ] Architecture supports all planned toolbar features
- [ ] Integration is clean and non-invasive
- [ ] Performance impact is minimal
- [ ] Foundation is solid for feature implementation

## Success Criteria

- ✅ New toolbar architecture is established
- ✅ Integration points are clean and well-defined
- ✅ Structure supports all planned features
- ✅ No existing functionality is broken
