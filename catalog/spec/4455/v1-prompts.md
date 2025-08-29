<!-- markdownlint-disable MD013 -->
# Prompts

## Key Fix Applied: Sequential Chain Clarification

**Problem Identified**: Original process wasn't clear about branching from spec branch (`4455-toolbar-00-spec`)

**Root Cause**:

- Process said "branch from master" for PR #1
- Dependencies said "None" for PR #1
- This led to incorrect branching and missing spec files

**Solution Applied**:

1. **Updated Process**: PR #1 now explicitly branches from `4455-toolbar-00-spec`
2. **Updated Dependencies**: All PRs now show clear predecessor relationships
3. **Updated Checklists**: Each checklist specifies correct base branch for PR creation
4. **Added PR Targeting**: Each checklist explicitly states which branch the PR should target

**Benefits of Fixed Approach**:

- ✅ Spec files automatically available in each branch
- ✅ Clear sequential chain: 00-spec → 01 → 02 → 03 → ... → 08 → master
- ✅ No checklist access issues
- ✅ Proper dependency management
- ✅ Each PR builds incrementally on previous work

## Execution Notes

**Phase 1 Attempted**:

- Incorrectly branched from master, created PR #4505
- Identified sequential chain issue
- Deleted branch and PR, fixed specs instead

**Key Learning**: Always validate the sequential chain setup before executing phases
