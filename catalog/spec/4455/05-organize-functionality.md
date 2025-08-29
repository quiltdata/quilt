<!-- markdownlint-disable line-length -->
# PR #5: Organize Functionality - Move & Delete

**Branch**: `4455-toolbar-05-organize-functionality`  
**Risk Level**: Medium  
**Dependencies**: PR #4 (merges into PR #4 branch)  
**Estimated Size**: ~12 files, +600/-100 lines

## Objective

Implement file organization features including move and delete operations. This introduces new delete functionality.

## Files to Cherry-Pick

- [ ] `catalog/app/containers/Bucket/Dir/Toolbar/Organize/Context.tsx`
- [ ] `catalog/app/containers/Bucket/Dir/Toolbar/Organize/Options.tsx`
- [ ] `catalog/app/containers/Bucket/File/Toolbar/Organize/Context.tsx`
- [ ] `catalog/app/containers/Bucket/File/Toolbar/Organize/Options.tsx`
- [ ] `catalog/app/containers/Bucket/Toolbar/DeleteDialog.tsx`
- [ ] `catalog/app/containers/Bucket/requests/object.ts` (delete functionality)

## Implementation Checklist

### Setup

- [ ] Create branch `4455-toolbar-05-organize-functionality` from `4455-toolbar-04-get-functionality`
- [ ] Cherry-pick Organize functionality files from `add-files-to-bucket`
- [ ] Single commit with message: "feat: Add Organize functionality with move and delete"

### Code Quality

- [ ] Delete confirmation flow is clear and safe
- [ ] Permission handling is correct
- [ ] Error states provide helpful feedback
- [ ] Bulk operations work reliably

### Testing

- [ ] Delete confirmation workflow tests
- [ ] Permission validation tests
- [ ] Error handling and recovery tests
- [ ] Bulk operation tests

### Local Testing (REQUIRED before pushing)

- [ ] Run `npm test` locally and verify all tests pass
- [ ] Run `npm run build` locally and verify TypeScript compilation succeeds
- [ ] Run `npm run lint` locally and fix any linting errors
- [ ] Test affected components manually in browser if applicable
- [ ] Verify no console errors when running the application locally
### Review Focus Areas

- [ ] Delete confirmation flow - is it safe and clear?
- [ ] Permission handling - proper authorization checks?
- [ ] Error states and recovery - good user experience?
- [ ] Bulk operations - performance and reliability?

### PR Workflow

- [ ] Push branch: `git push -u origin 4455-toolbar-05-organize-functionality`
- [ ] Create **DRAFT** PR with title: "toolbar-05: Add Organize functionality with move and delete operations"
- [ ] PR targets base branch: `4455-toolbar-04-get-functionality`
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
- [ ] Security review for delete operations completed
- [ ] Delete operations are safe and reversible where possible
- [ ] Permissions are properly enforced
- [ ] Error messages are helpful and actionable
- [ ] Bulk operations perform well
- [ ] Ready for merge into next phase

## Success Criteria

- ✅ File deletion functionality works safely
- ✅ Move operations are implemented correctly
- ✅ Permission handling is secure and proper
- ✅ User experience is clear and safe
