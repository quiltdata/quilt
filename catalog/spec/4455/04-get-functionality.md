<!-- markdownlint-disable line-length -->
# PR #4: Get Functionality - Download & Code Samples

**Branch**: `4455-toolbar-04-get-functionality`  
**Risk Level**: Low  
**Dependencies**: PR #3 (merges into PR #3 branch)  
**Estimated Size**: ~8 files, +300/-50 lines

## Objective

Implement the "Get" functionality for downloading files and viewing code samples. This is mostly moving existing functionality to the new architecture.

## Files to Cherry-Pick

- [ ] `catalog/app/containers/Bucket/Dir/Toolbar/Get/Options.tsx`
- [ ] `catalog/app/containers/Bucket/File/Toolbar/Get/Options.tsx`
- [ ] `catalog/app/containers/Bucket/Toolbar/GetOptions.tsx`
- [ ] `catalog/app/containers/Bucket/CodeSamples.tsx`
- [ ] `catalog/app/containers/Bucket/Download/Buttons.tsx`
- [ ] Updated download components

## Implementation Checklist

### Setup

- [ ] Create branch `4455-toolbar-04-get-functionality` from master
- [ ] Cherry-pick Get functionality files from `add-files-to-bucket`
- [ ] Single commit with message: "feat: Add Get functionality to toolbar"

### Code Quality

- [ ] Download functionality works in new architecture
- [ ] Code sample generation is preserved
- [ ] Error handling matches existing behavior
- [ ] UI/UX is consistent with design

### Testing

- [ ] Download functionality tests pass
- [ ] Code sample generation tests work
- [ ] Error scenarios are properly tested
- [ ] Integration tests with toolbar architecture

### Review Focus Areas

- [ ] Feature parity with existing download functionality
- [ ] Code sample generation accuracy and completeness
- [ ] Error handling and user feedback
- [ ] Integration with new toolbar architecture

### PR Requirements

- [ ] PR title: "toolbar-04: Add Get functionality for downloads and code samples"
- [ ] PR description explains feature migration
- [ ] Link to decomposition spec in description
- [ ] All CI checks pass
- [ ] Feature functionality verified

### Pre-Merge Validation

- [ ] All download features work as before
- [ ] Code samples generate correctly
- [ ] No regression in existing functionality
- [ ] Performance is maintained or improved

## Success Criteria

- ✅ Download functionality is fully migrated to new architecture
- ✅ Code sample generation works correctly
- ✅ Feature parity with existing implementation
- ✅ No regressions in user experience
