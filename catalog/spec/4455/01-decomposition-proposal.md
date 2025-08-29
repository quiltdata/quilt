<!-- markdownlint-disable MD013 -->
# Toolbar Refactor PR Decomposition Proposal

For re-factoring [Toolbar PR](https://github.com/quiltdata/quilt/pull/4455).

## Overview

The current PR "Bucket toolbar: refactor UI, add files dialog, delete files option"
is a large change (87 files, +4,791/-1,740 lines) that introduces significant
architectural changes. This document proposes breaking it down into 8 atomic
sub-PRs that can be independently reviewed and merged.

## Benefits of Decomposition

- **Reduced Review Complexity**: Smaller PRs are easier to review thoroughly
- **Faster Merge Cycle**: Individual PRs can be merged as they're approved
- **Reduced Risk**: Issues can be isolated to specific functionality
- **Better Git History**: Clear progression of changes with focused commits
- **Easier Rollbacks**: Individual features can be reverted if needed

## Proposed Sub-PRs

**Branch Naming Pattern**: `4455-toolbar-[phase]-[feature]`

### PR #1: Foundation: Shared Components & Types (Low Risk)

**Branch**: `4455-toolbar-01-shared-components`

**Estimated Size**: ~15 files, +500/-50 lines

**Dependencies**: None

#### Files

- `catalog/app/components/Buttons/WithPopover.tsx` (new)
- `catalog/app/components/Buttons/WithPopover.spec.tsx` (new)
- `catalog/app/components/Buttons/Iconized.tsx` (enhanced)
- `catalog/app/components/Buttons/Iconized.spec.tsx` (updated)
- `catalog/app/components/Dialog/PopoverOptions.tsx` (new)
- `catalog/app/containers/Bucket/Toolbar/types.ts` (new)
- `catalog/app/containers/Bucket/Toolbar/ErrorBoundary.tsx` (new)
- Snapshot updates

#### Description

Core UI components and type definitions that will be used by all toolbar modules. This establishes the foundation without changing any existing functionality.

#### Review Focus

- Component API design
- TypeScript type definitions
- Test coverage
- Accessibility

---

### PR #2: Cleanup: Remove Unused Components (Low Risk)

**Branch**: `4455-toolbar-02-cleanup-unused`

**Estimated Size**: ~10 files, +0/-600 lines

**Dependencies**: PR #1

#### Files

- Remove `catalog/app/containers/Admin/Sync.tsx`
- Remove `catalog/app/containers/Bucket/Upload.tsx`
- Remove old download components:
  - `catalog/app/containers/Bucket/Download/BucketCodeSamples.tsx`
  - `catalog/app/containers/Bucket/Download/BucketOptions.tsx`
  - `catalog/app/containers/Bucket/Download/Button.tsx`
  - `catalog/app/containers/Bucket/Download/OptionsTabs.tsx`
- Update imports and references

#### Description

Remove deprecated and unused components to reduce codebase complexity.

#### Review Focus

- Ensure no remaining references
- Verify no breaking changes to existing functionality

---

### PR #3: Core Architecture: Base Toolbar Structure (Medium Risk)

**Branch**: `4455-toolbar-03-base-structure`

**Estimated Size**: ~12 files, +400/-100 lines

**Dependencies**: PR #1, #2

#### Files

- `catalog/app/containers/Bucket/Toolbar/Toolbar.tsx` (new)
- `catalog/app/containers/Bucket/Toolbar/Toolbar.spec.tsx` (new)
- `catalog/app/containers/Bucket/Dir/Toolbar/Toolbar.tsx` (new)
- `catalog/app/containers/Bucket/Dir/Toolbar/Toolbar.spec.tsx` (new)
- `catalog/app/containers/Bucket/File/Toolbar/Toolbar.tsx` (new)
- `catalog/app/containers/Bucket/File/Toolbar/Toolbar.spec.tsx` (new)
- Basic integration into `Dir.tsx` and `File.js`

#### Description

Establish the new toolbar architecture with empty/minimal implementations. This creates the structure without implementing specific features.

#### Review Focus

- Architecture pattern
- Component composition approach
- Integration points
- Test structure

---

### PR #4: Get Functionality: Download & Code Samples (Low Risk)

**Branch**: `4455-toolbar-04-get-functionality`

**Estimated Size**: ~8 files, +300/-50 lines

**Dependencies**: PR #3

#### Files

- `catalog/app/containers/Bucket/Dir/Toolbar/Get/Options.tsx`
- `catalog/app/containers/Bucket/File/Toolbar/Get/Options.tsx`
- `catalog/app/containers/Bucket/Toolbar/GetOptions.tsx`
- `catalog/app/containers/Bucket/CodeSamples.tsx`
- `catalog/app/containers/Bucket/Download/Buttons.tsx`
- Updated download components

#### Description

Implement the "Get" functionality for downloading files and viewing code samples. This is mostly moving existing functionality to the new architecture.

#### Review Focus

- Feature parity with existing download functionality
- Code sample generation
- Error handling

---

### PR #5: Organize Functionality: Move & Delete (Medium Risk)

**Branch**: `4455-toolbar-05-organize-functionality`

**Estimated Size**: ~12 files, +600/-100 lines

**Dependencies**: PR #3

#### Files

- `catalog/app/containers/Bucket/Dir/Toolbar/Organize/Context.tsx`
- `catalog/app/containers/Bucket/Dir/Toolbar/Organize/Options.tsx`
- `catalog/app/containers/Bucket/File/Toolbar/Organize/Context.tsx`
- `catalog/app/containers/Bucket/File/Toolbar/Organize/Options.tsx`
- `catalog/app/containers/Bucket/Toolbar/DeleteDialog.tsx`
- `catalog/app/containers/Bucket/requests/object.ts` (delete functionality)

#### Description

Implement file organization features including move and delete operations. This introduces new delete functionality.

#### Review Focus

- Delete confirmation flow
- Permission handling
- Error states and recovery
- Bulk operations

---

### PR #6: Add Functionality: File Upload Dialog (High Risk)

**Branch**: `4455-toolbar-06-add-functionality`

**Estimated Size**: ~8 files, +800/-200 lines

**Dependencies**: PR #3

#### Files

- `catalog/app/containers/Bucket/Dir/Toolbar/Add/Context.tsx`
- `catalog/app/containers/Bucket/Dir/Toolbar/Add/Options.tsx`
- `catalog/app/containers/Bucket/Dir/Toolbar/Add/UploadDialog.tsx`
- `catalog/app/containers/Bucket/DndWrapper.tsx`
- `catalog/app/utils/dragging.ts` (enhancements)

#### Description

Implement the new file upload dialog with drag-and-drop functionality.

#### Review Focus

- File upload UX
- Drag-and-drop behavior
- Progress indicators
- Error handling
- Large file handling

---

### PR #7: Create Package Functionality (Medium Risk)

**Branch**: `4455-toolbar-07-create-package`

**Estimated Size**: ~8 files, +400/-50 lines

**Dependencies**: PR #3

#### Files

- `catalog/app/containers/Bucket/Dir/Toolbar/CreatePackage/Options.tsx`
- `catalog/app/containers/Bucket/Dir/Toolbar/CreatePackage/useSuccessors.ts`
- Enhanced package creation components
- Integration with existing package dialog

#### Description

Implement package creation functionality in the new toolbar architecture.

#### Review Focus

- Package creation workflow
- Successors handling
- Integration with existing package system

---

### PR #8: Integration & Polish: Final Cleanup (Low Risk)

**Branch**: `4455-toolbar-08-final-integration`

**Estimated Size**: ~15 files, +200/-100 lines

**Dependencies**: PR #4, #5, #6, #7

#### Files

- Complete integration in `Dir.tsx` and `File.js`
- `catalog/app/containers/Bucket/Selection/Dashboard.tsx` (enhancements)
- `catalog/app/containers/Bucket/Listing.tsx` (updates)
- `catalog/app/containers/Bucket/ListingActions.tsx` (updates)
- Embed component updates
- Final test updates and snapshots
- Documentation updates

#### Description

Complete the integration, update all consuming components, and add final polish.

#### Review Focus

- Complete feature integration
- Backward compatibility
- Performance impact
- Documentation completeness

## Implementation Strategy

### Phase 1: Foundation (PRs #1-2)

- Can be developed and reviewed in parallel
- Low risk, high confidence changes
- Establishes foundation for all other work

### Phase 2: Architecture (PR #3)

- Depends on Phase 1
- Critical architecture decisions
- Should be thoroughly reviewed before proceeding

### Phase 3: Features (PRs #4-7)

- Can be developed in parallel after PR #3
- Each implements a specific feature set
- Independent testing and validation

### Phase 4: Integration (PR #8)

- Final integration after all features complete
- Comprehensive testing
- Documentation and changelog updates

## Risk Assessment

| PR | Risk Level | Reasoning |
|----|------------|-----------|
| #1 | Low | New components, no existing functionality changes |
| #2 | Low | Pure removal of unused code |
| #3 | Medium | Architecture changes, but minimal functionality |
| #4 | Low | Mostly moving existing functionality |
| #5 | Medium | New delete functionality, state changes |
| #6 | High | Complex upload UX, file handling |
| #7 | Medium | Package creation integration |
| #8 | Low | Integration and polish, well-defined scope |

## Testing Strategy

Each PR should include:

- Unit tests for new components
- Integration tests for workflows
- Snapshot tests for UI components
- Manual testing checklist for the specific feature

## Migration Notes

- Each PR maintains backward compatibility until final integration
- Feature flags could be used to gradually enable new functionality
- Rollback strategy defined for each PR

## Timeline Estimate

- **Phase 1**: 1-2 days development, 1 day review
- **Phase 2**: 2-3 days development, 2 days review
- **Phase 3**: 5-7 days development (parallel), 3-4 days review
- **Phase 4**: 1-2 days development, 1 day review

**Total**: ~2-3 weeks vs 1-2 weeks for monolithic review (but with
higher quality and lower risk)
