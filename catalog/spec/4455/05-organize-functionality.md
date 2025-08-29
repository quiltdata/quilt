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

### Review Focus Areas

- [ ] Delete confirmation flow - is it safe and clear?
- [ ] Permission handling - proper authorization checks?
- [ ] Error states and recovery - good user experience?
- [ ] Bulk operations - performance and reliability?

### PR Requirements

- [ ] PR title: "toolbar-05: Add Organize functionality with move and delete operations"
- [ ] PR targets base branch: `4455-toolbar-04-get-functionality`
- [ ] PR description explains new delete features (copy this checklist into description)
- [ ] Link to decomposition spec in description
- [ ] All CI checks pass
- [ ] Security review for delete operations

### Pre-Merge Validation

- [ ] Delete operations are safe and reversible where possible
- [ ] Permissions are properly enforced
- [ ] Error messages are helpful and actionable
- [ ] Bulk operations perform well

## Success Criteria

- ✅ File deletion functionality works safely
- ✅ Move operations are implemented correctly
- ✅ Permission handling is secure and proper
- ✅ User experience is clear and safe
