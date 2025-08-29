<!-- markdownlint-disable line-length -->
# PR #8: Final Integration - Complete Integration and Polish

**Branch**: `4455-toolbar-08-final-integration`  
**Risk Level**: Low  
**Dependencies**: PR #7 (merges into PR #7 branch, final merge to master)  
**Estimated Size**: ~15 files, +200/-100 lines

## Objective

Complete the integration, update all consuming components, and add final polish to complete the toolbar refactor.

## Files to Cherry-Pick

- [ ] `catalog/app/containers/Bucket/Dir.tsx` (complete integration)
- [ ] `catalog/app/containers/Bucket/File.js` (complete integration)
- [ ] `catalog/app/containers/Bucket/Dashboard.tsx` (updates)
- [ ] `catalog/app/containers/Bucket/Listing.tsx` (updates)
- [ ] `catalog/app/containers/Bucket/ListingActions.tsx` (updates)
- [ ] Final toolbar component exports
- [ ] Updated component imports across the application
- [ ] Performance optimizations
- [ ] Final accessibility improvements

## Implementation Checklist

### Setup

- [ ] Create branch `4455-toolbar-08-final-integration` from `4455-toolbar-07-create-package`
- [ ] Cherry-pick final integration files from `add-files-to-bucket`
- [ ] Single commit with message: "feat: Complete toolbar integration and add final polish"

### Code Quality

- [ ] All consuming components properly integrate new toolbar
- [ ] No legacy toolbar code remains
- [ ] Performance is maintained or improved
- [ ] Accessibility standards are met throughout
- [ ] Code organization is clean and maintainable

### Testing

- [ ] Full integration tests pass
- [ ] All existing functionality works correctly
- [ ] Performance regression tests
- [ ] Accessibility compliance tests
- [ ] Cross-browser compatibility tests

### Review Focus Areas

- [ ] Integration completeness - all components properly updated?
- [ ] Performance impact - no regressions introduced?
- [ ] Accessibility - full compliance maintained?
- [ ] Code quality - clean and maintainable?
- [ ] User experience - smooth and consistent?

### PR Requirements

- [ ] PR title: "toolbar-08: Complete toolbar integration and add final polish"
- [ ] PR targets base branch: `4455-toolbar-07-create-package`
- [ ] PR description explains integration completion (copy this checklist into description)
- [ ] Link to decomposition spec in description
- [ ] All CI checks pass
- [ ] Full regression testing completed
- [ ] Performance benchmarks validated

### Pre-Merge Validation

- [ ] All existing functionality works correctly
- [ ] No performance regressions detected
- [ ] Accessibility standards are maintained
- [ ] Code quality meets project standards
- [ ] User experience is smooth and consistent

## Success Criteria

- ✅ All components successfully integrated with new toolbar
- ✅ No legacy toolbar code remains in the codebase
- ✅ Performance is maintained or improved
- ✅ Full accessibility compliance achieved
- ✅ Clean, maintainable code organization established