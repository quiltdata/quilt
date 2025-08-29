<!-- markdownlint-disable line-length -->
# PR #1: Foundation - Shared Components & Types

**Branch**: `4455-toolbar-01-shared-components`  
**Risk Level**: Low  
**Dependencies**: Spec branch (`4455-toolbar-00-spec`)  
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

- [x] Create branch `4455-toolbar-01-shared-components` from `4455-toolbar-00-spec`
- [x] Cherry-pick only the files listed above from `add-files-to-bucket`
- [x] Single commit with message: "feat: Add shared toolbar components and types"

### Code Quality

- [x] Fix any IDE diagnostics (fixed TypeScript error in Successors.tsx)
- [x] Verify TypeScript compilation
- [ ] Check component prop interfaces are well-defined
- [ ] Ensure accessibility attributes are present

### Testing

- [x] All new components have unit tests
- [x] Snapshot tests are included
- [ ] Test coverage for component APIs
- [ ] No existing tests are broken

### Review Focus Areas

- [ ] Component API design - are interfaces clean and extensible?
- [x] TypeScript type definitions - comprehensive and correct?
- [ ] Test coverage - adequate for new components?
- [ ] Accessibility - proper ARIA attributes and keyboard support?
- [ ] Documentation - JSDoc comments for public APIs?

### Local Testing (REQUIRED before pushing)

- [x] Run `npm test` locally and verify all tests pass
- [x] Run `npm run build` locally and verify TypeScript compilation succeeds
- [x] Run `npm run lint` locally and fix any linting errors
- [x] Test affected components manually in browser if applicable
- [x] Verify no console errors when running the application locally

### PR Workflow

- [x] Push branch: `git push -u origin 4455-toolbar-01-shared-components`
- [x] Create PR with title: "toolbar-01: Add shared components and types for toolbar refactor"
- [x] PR targets base branch: `4455-toolbar-00-spec`
- [x] Copy this checklist into PR description
- [x] Link to decomposition spec in description

### PR Comments (5 total from Greptile review)

- [x] **WithPopover.tsx:89** - Fix click propagation: Add `event.stopPropagation()` to prevent popup close on content interaction
- [x] **ErrorBoundary.tsx:27** - Replace `$TSFixMe` with proper TypeScript interface for info parameter
- [x] **PopoverOptions.tsx:131-155** - Resolve naming conflict: Tabs/TabPanel exports conflict with OptionsTabs.tsx
- [x] **PopoverOptions.tsx:141-149** - Fix React key issue: Use unique id field instead of array index for tabs
- [x] **Iconized.tsx:42** - Extract arrow function component to avoid React DevTools issues

### CI & Review Cycle

CRITICAL: Complete this entire cycle - do not stop until PR is merge-ready

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
- [ ] No breaking changes to existing functionality
- [ ] Components are reusable and well-abstracted
- [ ] Type definitions support planned toolbar features
- [ ] Documentation is complete and accurate
- [ ] Ready for merge into next phase

## Success Criteria

- ✅ New shared components are available for use by toolbar modules
- ✅ Type definitions provide strong typing for toolbar functionality  
- ✅ No existing functionality is modified or broken
- ✅ Foundation is established for subsequent PRs
- ✅ Code quality standards are maintained
