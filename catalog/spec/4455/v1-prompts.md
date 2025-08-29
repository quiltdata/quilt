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

**Phase 1 - First Attempt (Failed)**:

- Incorrectly branched from master, created PR #4505  
- Identified sequential chain issue
- Deleted branch and PR, fixed specs instead

**Phase 1 - Second Attempt (Successful)**:

- ✅ Branched from `4455-toolbar-00-spec`
- ✅ All spec files automatically available
- ✅ Cherry-picked 8 files correctly using `git checkout add-files-to-bucket -- [files]`
- ✅ Single commit with lint-staged passing automatically
- ✅ No IDE diagnostics found
- ✅ PR created targeting `4455-toolbar-00-spec` base branch
- ✅ Checklist successfully copied into PR description
- ✅ CI running - all checks pending, no failures yet

**Improvements Made**:

1. ✅ Fixed all checklist files to include complete workflow sections
2. ✅ Added PR Workflow, CI & Review Cycle, and Pre-Merge Validation sections
3. ✅ Sequential chain now crystal clear in all specs

**Execution Metrics**:

- **PR Created**: [#4506](https://github.com/quiltdata/quilt/pull/4506)
- **Files Changed**: 8 files (+699/-56 lines)  
- **Time to Execute**: ~5 minutes (much faster with correct process)
- **Issues Encountered**: None with corrected sequential chain

**Key Learning**: Sequential chain from spec branch works perfectly - no access issues, clean workflow
