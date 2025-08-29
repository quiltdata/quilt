<!-- markdownlint-disable line-length -->
# PR #7: Create Package - Package Creation Functionality

**Branch**: `4455-toolbar-07-create-package`  
**Risk Level**: Medium  
**Dependencies**: PR #3  
**Estimated Size**: ~8 files, +400/-50 lines

## Objective

Implement package creation functionality in the new toolbar architecture with enhanced UI components and improved workflow.

## Files to Cherry-Pick

- [ ] `catalog/app/containers/Bucket/Dir/Toolbar/CreatePackage/Options.tsx`
- [ ] `catalog/app/containers/Bucket/Dir/Toolbar/CreatePackage/Context.tsx`
- [ ] `catalog/app/containers/Bucket/Dir/Toolbar/CreatePackage/index.ts`
- [ ] `catalog/app/utils/useSuccessors.ts` (new)
- [ ] Enhanced package creation components
- [ ] Package validation utilities
- [ ] Package metadata handling

## Implementation Checklist

### Setup

- [ ] Create branch `4455-toolbar-07-create-package` from master
- [ ] Cherry-pick CreatePackage functionality files from `add-files-to-bucket`
- [ ] Single commit with message: "feat: Add package creation functionality to toolbar"

### Code Quality

- [ ] Package creation workflow is intuitive and clear
- [ ] Form validation provides helpful feedback
- [ ] Package metadata handling is robust
- [ ] Error states are well-designed and informative
- [ ] Success states provide clear next steps

### Testing

- [ ] Package creation workflow tests
- [ ] Form validation tests
- [ ] Package metadata tests
- [ ] Error handling tests
- [ ] Success flow tests

### Review Focus Areas

- [ ] Package creation UX - smooth and intuitive workflow?
- [ ] Form validation - comprehensive and user-friendly?
- [ ] Package metadata - properly captured and validated?
- [ ] Error handling - clear and actionable messages?
- [ ] Success feedback - guides user to next steps?

### PR Requirements

- [ ] PR title: "toolbar-07: Add package creation functionality with enhanced UI"
- [ ] PR description explains package creation features
- [ ] Link to decomposition spec in description
- [ ] All CI checks pass
- [ ] UX review for package creation flow

### Pre-Merge Validation

- [ ] Package creation works reliably
- [ ] Form validation catches all edge cases
- [ ] Package metadata is properly structured
- [ ] Error messages are helpful and specific
- [ ] Success flow guides users effectively

## Success Criteria

- ✅ Package creation functionality works smoothly
- ✅ Form validation provides clear feedback
- ✅ Package metadata is properly handled
- ✅ Error and success states are well-designed