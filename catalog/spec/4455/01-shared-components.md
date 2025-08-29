<!-- markdownlint-disable line-length -->
# PR #1: Foundation - Shared Components & Types

**Branch**: `4455-toolbar-01-shared-components`  
**Risk Level**: Low  
**Dependencies**: None  
**Estimated Size**: ~15 files, +500/-50 lines

## Objective

Create core UI components and type definitions that will be used by all toolbar modules. This establishes the foundation without changing any existing functionality.

## Files to Cherry-Pick

- [ ] `catalog/app/components/Buttons/WithPopover.tsx` (new)
- [ ] `catalog/app/components/Buttons/WithPopover.spec.tsx` (new)
- [ ] `catalog/app/components/Buttons/Iconized.tsx` (enhanced)
- [ ] `catalog/app/components/Buttons/Iconized.spec.tsx` (updated)
- [ ] `catalog/app/components/Dialog/PopoverOptions.tsx` (new)
- [ ] `catalog/app/containers/Bucket/Toolbar/types.ts` (new)
- [ ] `catalog/app/containers/Bucket/Toolbar/ErrorBoundary.tsx` (new)
- [ ] Snapshot updates

## Implementation Checklist

### Setup

- [ ] Create branch `4455-toolbar-01-shared-components` from master
- [ ] Cherry-pick only the files listed above from `add-files-to-bucket`
- [ ] Single commit with message: "feat: Add shared toolbar components and types"

### Code Quality

- [ ] Fix any IDE diagnostics
- [ ] Verify TypeScript compilation
- [ ] Check component prop interfaces are well-defined
- [ ] Ensure accessibility attributes are present

### Testing

- [ ] All new components have unit tests
- [ ] Snapshot tests are included
- [ ] Test coverage for component APIs
- [ ] No existing tests are broken

### Review Focus Areas

- [ ] Component API design - are interfaces clean and extensible?
- [ ] TypeScript type definitions - comprehensive and correct?
- [ ] Test coverage - adequate for new components?
- [ ] Accessibility - proper ARIA attributes and keyboard support?
- [ ] Documentation - JSDoc comments for public APIs?

### PR Requirements

- [ ] PR title: "toolbar-01: Add shared components and types for toolbar refactor"
- [ ] PR description explains foundation purpose
- [ ] Link to decomposition spec in description
- [ ] All CI checks pass
- [ ] Code review completed and approved

### Pre-Merge Validation

- [ ] No breaking changes to existing functionality
- [ ] Components are reusable and well-abstracted
- [ ] Type definitions support planned toolbar features
- [ ] Documentation is complete and accurate

## Success Criteria

- ✅ New shared components are available for use by toolbar modules
- ✅ Type definitions provide strong typing for toolbar functionality  
- ✅ No existing functionality is modified or broken
- ✅ Foundation is established for subsequent PRs
- ✅ Code quality standards are maintained
