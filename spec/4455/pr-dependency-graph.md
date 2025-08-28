# PR Dependency Graph

This document visualizes the dependencies between the proposed sub-PRs for the toolbar refactor.

## Visual Dependency Tree

```
Phase 1 (Foundation)
├── PR #1: Shared Components & Types
└── PR #2: Remove Unused Components
    │
    └── Phase 2 (Architecture)
        └── PR #3: Base Toolbar Structure
            │
            └── Phase 3 (Features - Can be parallel)
                ├── PR #4: Get Functionality
                ├── PR #5: Organize Functionality  
                ├── PR #6: Add Functionality
                └── PR #7: Create Package Functionality
                    │
                    └── Phase 4 (Integration)
                        └── PR #8: Final Integration & Polish
```

## Detailed Dependencies

### PR #1: Shared Components & Types

- **Depends on**: Nothing
- **Blocks**: All other PRs (provides foundation)
- **Can merge**: Immediately after review

### PR #2: Remove Unused Components  

- **Depends on**: PR #1 (to avoid conflicts)
- **Blocks**: PR #3 (clean slate for new architecture)
- **Can merge**: After PR #1

### PR #3: Base Toolbar Structure

- **Depends on**: PR #1, PR #2
- **Blocks**: PR #4, #5, #6, #7 (provides structure)
- **Can merge**: After PR #1 and #2

### PR #4: Get Functionality

- **Depends on**: PR #3
- **Blocks**: PR #8
- **Can merge**: After PR #3, independently of #5, #6, #7

### PR #5: Organize Functionality

- **Depends on**: PR #3  
- **Blocks**: PR #8
- **Can merge**: After PR #3, independently of #4, #6, #7

### PR #6: Add Functionality

- **Depends on**: PR #3
- **Blocks**: PR #8
- **Can merge**: After PR #3, independently of #4, #5, #7

### PR #7: Create Package Functionality

- **Depends on**: PR #3
- **Blocks**: PR #8  
- **Can merge**: After PR #3, independently of #4, #5, #6

### PR #8: Final Integration & Polish

- **Depends on**: PR #4, #5, #6, #7 (all features complete)
- **Blocks**: Nothing
- **Can merge**: After all feature PRs are complete

## Merge Strategy Options

### Option A: Sequential (Conservative)

```
PR #1 → PR #2 → PR #3 → PR #4 → PR #5 → PR #6 → PR #7 → PR #8
```

- **Timeline**: ~3-4 weeks
- **Risk**: Lowest
- **Complexity**: Lowest

### Option B: Parallel Features (Recommended)

```
PR #1 → PR #2 → PR #3 → [PR #4, #5, #6, #7 in parallel] → PR #8
```

- **Timeline**: ~2-3 weeks  
- **Risk**: Low-Medium
- **Complexity**: Medium

### Option C: Maximum Parallelism (Aggressive)

```
[PR #1, #2 in parallel] → PR #3 → [PR #4, #5, #6, #7 in parallel] → PR #8
```

- **Timeline**: ~2 weeks
- **Risk**: Medium  
- **Complexity**: Higher

## Conflict Resolution

### Potential Conflicts

- **PR #1 & #2**: Minimal risk (different file sets)
- **PR #4-7**: Low risk (different modules, shared foundation)
- **All → #8**: Managed through careful integration planning

### Mitigation Strategies

1. **Clear Interface Contracts**: PR #1 and #3 establish stable APIs
2. **Regular Rebasing**: Feature PRs rebase on latest foundation changes
3. **Integration Testing**: PR #8 includes comprehensive cross-feature testing
4. **Communication**: Team coordination on parallel development

## Rollback Strategy

Each PR can be independently rolled back:

- **PR #1-2**: Safe rollback (foundation changes)
- **PR #3**: Rollback to old toolbar system
- **PR #4-7**: Individual feature rollback without affecting others
- **PR #8**: Rollback to partial feature state

## Benefits of This Approach

1. **Reduced Cognitive Load**: Each PR focuses on one concern
2. **Faster Iteration**: Parallel development and review
3. **Lower Risk**: Individual features can be disabled/rolled back
4. **Better Testing**: Focused testing per feature
5. **Clearer History**: Git history shows clear progression
6. **Team Efficiency**: Multiple developers can work in parallel
