<!-- markdownlint-disable line-length -->
# PR #6: Add Functionality - File Upload Dialog

**Branch**: `4455-toolbar-06-add-functionality`  
**Risk Level**: High  
**Dependencies**: PR #5 (merges into PR #5 branch)  
**Estimated Size**: ~8 files, +800/-200 lines

## Objective

Implement the new file upload dialog with drag-and-drop functionality.

## Files to Cherry-Pick

- [ ] `catalog/app/containers/Bucket/Dir/Toolbar/Add/Context.tsx`
- [ ] `catalog/app/containers/Bucket/Dir/Toolbar/Add/Options.tsx`
- [ ] `catalog/app/containers/Bucket/Dir/Toolbar/Add/UploadDialog.tsx`
- [ ] `catalog/app/containers/Bucket/DndWrapper.tsx`
- [ ] `catalog/app/utils/dragging.ts` (enhancements)

## Implementation Checklist

### Setup

- [ ] Create branch `4455-toolbar-06-add-functionality` from `4455-toolbar-05-organize-functionality`
- [ ] Cherry-pick Add functionality files from `add-files-to-bucket`
- [ ] Single commit with message: "feat: Add file upload functionality with drag-and-drop"

### Code Quality

- [ ] File upload UX is intuitive and responsive
- [ ] Drag-and-drop behavior works across browsers
- [ ] Progress indicators provide clear feedback
- [ ] Error handling covers edge cases
- [ ] Large file handling is optimized

### Testing

- [ ] File upload workflow tests
- [ ] Drag-and-drop interaction tests
- [ ] Progress indicator tests
- [ ] Error handling tests
- [ ] Large file upload tests

### Local Testing (REQUIRED before pushing)

- [ ] Run `npm test` locally and verify all tests pass
- [ ] Run `npm run build` locally and verify TypeScript compilation succeeds
- [ ] Run `npm run lint` locally and fix any linting errors
- [ ] Test affected components manually in browser if applicable
- [ ] Verify no console errors when running the application locally

### Review Focus Areas

- [ ] File upload UX - intuitive and user-friendly?
- [ ] Drag-and-drop behavior - works reliably?
- [ ] Progress indicators - clear and helpful?
- [ ] Error handling - comprehensive and informative?
- [ ] Large file handling - performance and reliability?

### PR Workflow

- [ ] Push branch: `git push -u origin 4455-toolbar-06-add-functionality`
- [ ] Create **DRAFT** PR with title: "toolbar-06: Add file upload functionality with drag-and-drop support"
- [ ] PR targets base branch: `4455-toolbar-05-organize-functionality`
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
- [ ] UX review for upload experience completed
- [ ] File uploads work reliably across file types
- [ ] Drag-and-drop is smooth and responsive
- [ ] Progress feedback is clear and accurate
- [ ] Error messages are helpful and actionable
- [ ] Performance is acceptable for large files
- [ ] Ready for merge into next phase

## Success Criteria

- ✅ File upload functionality works smoothly
- ✅ Drag-and-drop interface is intuitive
- ✅ Progress indicators provide clear feedback
- ✅ Error handling covers all scenarios
