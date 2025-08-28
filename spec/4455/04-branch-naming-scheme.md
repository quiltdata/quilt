# Branch Naming Scheme for Toolbar Refactor

## Pattern: `4455-toolbar-[phase]-[feature]`

### Specification Branch:
- `4455-toolbar-00-decomposition-spec` (this branch - planning and documentation)

### Implementation Branches:

**Phase 1 (Foundation):**
- `4455-toolbar-01-shared-components`
- `4455-toolbar-01-cleanup-unused`

**Phase 2 (Architecture):**
- `4455-toolbar-02-base-structure`

**Phase 3 (Features):**
- `4455-toolbar-03-get-functionality`
- `4455-toolbar-03-organize-functionality`
- `4455-toolbar-03-add-functionality`
- `4455-toolbar-03-create-package`

**Phase 4 (Integration):**
- `4455-toolbar-04-final-integration`

## Benefits of This Naming Scheme:

1. **Issue Tracking**: `4455` prefix clearly links to the original issue/PR
2. **Feature Grouping**: All toolbar refactor branches are easily identifiable
3. **Phase Organization**: Phase numbers show dependencies and parallel work
4. **Clear Sorting**: Branches sort naturally by implementation order
5. **Self-Documenting**: Branch name explains the scope and context

## Usage Examples:

```bash
# Specification phase (this branch)
git checkout -b 4455-toolbar-00-decomposition-spec

# Phase 1 (can be parallel)
git checkout -b 4455-toolbar-01-shared-components
git checkout -b 4455-toolbar-01-cleanup-unused

# Phase 2 (after Phase 1)
git checkout -b 4455-toolbar-02-base-structure

# Phase 3 (parallel after Phase 2)
git checkout -b 4455-toolbar-03-get-functionality
git checkout -b 4455-toolbar-03-organize-functionality
git checkout -b 4455-toolbar-03-add-functionality
git checkout -b 4455-toolbar-03-create-package

# Phase 4 (after all Phase 3)
git checkout -b 4455-toolbar-04-final-integration
```

## PR Title Convention:

Match the branch names for consistency:
- `[4455] Toolbar: Shared Components & Types`
- `[4455] Toolbar: Cleanup Unused Components`
- `[4455] Toolbar: Base Structure`
- `[4455] Toolbar: Get Functionality`
- `[4455] Toolbar: Organize Functionality`
- `[4455] Toolbar: Add Functionality`
- `[4455] Toolbar: Create Package`
- `[4455] Toolbar: Final Integration`

## Alternative Shorter Pattern (if preferred):

### `4455-tb-[phase][feature-code]`
- `4455-tb-01-components`
- `4455-tb-01-cleanup`
- `4455-tb-02-structure`
- `4455-tb-03-get`
- `4455-tb-03-organize`
- `4455-tb-03-add`
- `4455-tb-03-package`
- `4455-tb-04-integration`

## Git Commands Reference:

```bash
# List all toolbar refactor branches
git branch --list "*4455-toolbar*"

# Create feature branch from base
git checkout 4455-toolbar-02-base-structure
git checkout -b 4455-toolbar-03-get-functionality

# Track progress across branches
git log --oneline --graph --all --grep="4455"
```

This naming scheme ensures clear organization and traceability for the entire toolbar refactor project.