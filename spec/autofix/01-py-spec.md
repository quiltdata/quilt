<!-- markdownlint-disable MD013 -->
# Unified Python CI with Autofix Specification

## Overview

This specification defines a SINGLE unified workflow that automatically fixes ALL and ONLY files that fail the original py-ci.yml validation tests. The workflow prevents race conditions by running autofix BEFORE validation in a sequential pipeline.

## Design Principles

**Core Requirements:**
1. **Fix ALL and ONLY fixable violations**: Target pycodestyle and isort issues that have deterministic auto-fixes
2. **Sequential execution**: Autofix must complete BEFORE validation to prevent race conditions  
3. **Comprehensive scope**: Handle every file that would fail the original validation tests
4. **Zero disruption**: Preserve all existing functionality exactly as-is

**Auto-Fixable Tests (2 types):**
- pycodestyle violations → `autopep8 --in-place` fixes
- isort import sorting → `isort .` fixes

**Validation-Only Tests (5 categories):**
- pylint code quality, documentation generation/testing, unit/integration tests, release processes

## Implementation Strategy

### Workflow Architecture
**Single unified workflow with three sequential phases:**

1. **AUTOFIX PHASE** (PR-only, with recursion prevention)
2. **VALIDATION PHASE** (runs on fixed code) 
3. **RELEASE PHASE** (tags only)

### Key Behaviors

**Autofix Execution:**
- Triggers: Pull requests with Python file changes
- Recursion prevention: Skip if commit message contains `[autofix]`
- Sequential jobs: autopep8 fixes → isort fixes → validation
- Commit strategy: Separate commits for each fix type with standardized messages

**File Targeting:**
- Include: All `*.py` files in repository
- Exclude: Virtual environments (`./venv/*`, `./.venv/*`, `./env/*`)
- Commands: Use `find` with `xargs` for consistent file discovery

**Error Handling:**
- Autofix failures don't block validation jobs
- Individual autofix jobs can fail independently
- All existing validation continues regardless of autofix status

## Technical Implementation Approach

### Workflow Structure
- **Name:** Unified Python CI with sequential autofix → validation → release phases
- **Triggers:** All existing triggers (push to master, tags, PRs, merge groups) plus concurrency controls
- **Permissions:** Autofix jobs require `contents: write` and `pull-requests: write` for PR commits

### Autofix Job Dependencies
- Jobs use `needs:` declarations to enforce sequential execution
- Validation jobs depend on autofix completion (`needs: [autofix-lint, autofix-isort]`)
- Use `if: always()` to ensure validation runs even if autofix fails
- Release jobs maintain existing tag-only conditions

### Autofix Job Behaviors

**autofix-lint Job:**

- Conditionally runs on PRs (excludes autofix commits via message detection)
- Installs autopep8 and runs fixes on all Python files
- Commits changes with standardized `[autofix]` message prefix
- Pushes directly to PR branch using GITHUB_TOKEN

**autofix-isort Job:**

- Runs after autofix-lint completion (uses `needs: autofix-lint`)
- Applies import sorting to all Python files
- Independent operation - runs even if autopep8 fixes fail
- Commits with distinct message for import sorting changes

### Validation Strategy

**Testing Approach:**
- Create test PRs with intentional pycodestyle and isort violations
- Validate that fixes are applied correctly and commits are made
- Verify recursion prevention works (no infinite loops)
- Confirm validation jobs run on fixed code, not original violations

**Success Criteria:**
- All original py-ci.yml functionality preserved
- Autofix handles 100% of pycodestyle and isort violations
- Sequential execution prevents race conditions
- No false positives (only fix files that would actually fail validation)

### Security and Safety

**Recursion Prevention:**

- Primary: Commit message detection (`[autofix]` prefix skips workflow)
- Fallback: Actor-based detection for github-actions bot
- Multiple layers prevent infinite autofix loops

**Permissions:**

- Autofix jobs require `contents: write` and `pull-requests: write`
- Uses default GITHUB_TOKEN (no custom tokens needed)
- Permissions scoped to repository only

**Branch Protection:**

- Verify autofix commits are allowed on PR branches
- Monitor for unexpected behavior or permission issues

### Implementation Phases

**Phase 1:** Replace existing py-ci.yml with unified workflow
- Implement autofix jobs with recursion prevention
- Ensure all existing validation jobs remain unchanged
- Test sequential execution (autofix → validation)

**Phase 2:** Validation and refinement
- Verify comprehensive coverage of fixable violations
- Test edge cases (no changes, multiple fixes, failures)
- Confirm race condition elimination

**Phase 3:** Production deployment
- Monitor autofix effectiveness and accuracy
- Gather feedback on developer experience
- Iterate based on real-world usage patterns

### Maintenance and Monitoring

**Key Metrics:**

- Autofix success rate and types of violations fixed
- Workflow execution time and failure patterns
- Developer feedback on reduced manual work

**Ongoing Tasks:**

- Update tool versions (autopep8, isort, pycodestyle)
- Monitor for new auto-fixable violation types
- Review effectiveness against stated success criteria

**Rollback Strategy:**

- Immediate: Disable workflow via GitHub UI if critical issues arise
- Simple: Revert to validation-only workflow (previous py-ci.yml)
- No complex rollback needed due to preserved existing functionality
