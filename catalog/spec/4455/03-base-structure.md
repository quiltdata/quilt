<!-- markdownlint-disable line-length -->
# PR #3: Core Architecture - Base Toolbar Structure

**Branch**: `4455-toolbar-03-base-structure`  
**Risk Level**: Medium  
**Dependencies**: PR #2 (merges into PR #2 branch)  
**Estimated Size**: ~12 files, +400/-100 lines

## Objective

Establish the new toolbar architecture with empty/minimal implementations. This creates the structure without implementing specific features.

## Files to Cherry-Pick

- [x] `catalog/app/containers/Bucket/Toolbar/Toolbar.tsx` (new)
- [x] `catalog/app/containers/Bucket/Toolbar/Toolbar.spec.tsx` (new)
- [x] `catalog/app/containers/Bucket/Dir/Toolbar/Toolbar.tsx` (new)
- [x] `catalog/app/containers/Bucket/Dir/Toolbar/Toolbar.spec.tsx` (new)
- [x] `catalog/app/containers/Bucket/File/Toolbar/Toolbar.tsx` (new)
- [x] `catalog/app/containers/Bucket/File/Toolbar/Toolbar.spec.tsx` (new)
- [ ] Basic integration into `Dir.tsx` and `File.js`

## Implementation Checklist

### Setup

- [x] Create branch `4455-toolbar-03-base-structure` from `4455-toolbar-02-cleanup-unused`
- [x] Cherry-pick architecture files from `add-files-to-bucket`
- [x] Single commit with message: "feat: Add base toolbar architecture structure"

### PR Workflow

- [x] Push branch: `git push -u origin 4455-toolbar-03-base-structure`
- [x] Create **DRAFT** PR with title: "toolbar-03: Add base toolbar architecture structure"
- [x] PR targets base branch: `4455-toolbar-02-cleanup-unused`
- [x] Link to prior PR in description
- [x] Wait 5 minutes, identify errors, and add as a checklist to PR comment
- [ ] Mark PR as **ready for review** only after all CI checks pass and comments are resolved

### Local Testing (REQUIRED before pushing)

- [ ] Run `npm test` locally and verify all tests pass
- [ ] Run `npm run build` locally and verify TypeScript compilation succeeds
- [ ] Run `npm run lint` locally and fix any linting errors
- [ ] Test affected components manually in browser if applicable
- [ ] Verify no console errors when running the application locally

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
