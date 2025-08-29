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

### Local Testing (REQUIRED before pushing)

- [ ] Run `npm test` locally and verify all tests pass
- [ ] Run `npm run build` locally and verify TypeScript compilation succeeds
- [ ] Run `npm run lint` locally and fix any linting errors
- [ ] Test affected components manually in browser if applicable
- [ ] Verify no console errors when running the application locally

### Review Focus Areas

- [ ] Architecture pattern - is it extensible and maintainable?
- [ ] Component composition approach - clean separation of concerns?
- [ ] Integration points - minimal impact on existing code?
- [ ] Test structure - supports future feature testing?

### PR Workflow

- [ ] Push branch: `git push -u origin 4455-toolbar-03-base-structure`
- [ ] Create PR with title: "toolbar-03: Add base toolbar architecture structure"
- [ ] PR targets base branch: `4455-toolbar-02-cleanup-unused`
- [ ] Copy this checklist into PR description
- [ ] Link to decomposition spec in description

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
- [ ] Architecture supports all planned toolbar features
- [ ] Integration is clean and non-invasive
- [ ] Performance impact is minimal
- [ ] Foundation is solid for feature implementation
- [ ] Ready for merge into next phase

## Success Criteria

- ✅ New toolbar architecture is established
- ✅ Integration points are clean and well-defined
- ✅ Structure supports all planned features
- ✅ No existing functionality is broken
