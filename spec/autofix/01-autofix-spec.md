<!-- markdownlint-disable MD013 -->
# GitHub Actions Autofix Specification

## Overview

This specification outlines the conversion of `.github/workflows/py-ci.yml` from a validation-only workflow to an autofix workflow that automatically corrects linting issues, formatting problems, and other fixable errors, then commits and pushes the changes back to the repository.

## Current State Analysis

The existing `py-ci.yml` workflow contains these jobs that can be converted to autofix:

1. **linter** - Runs `pylint` and `pycodestyle` (lines 10-26)
2. **isort** - Checks import sorting with `isort --check --diff` (lines 28-41)
3. Other jobs (test-gendocs, test-testdocs, test-client, test-lambda) - Keep as validation-only

## Autofix Implementation Plan

### 1. Workflow Triggers

**Current:**

```yaml
on:
  push:
    branches: [master]
    tags: ["*"]
  pull_request:
  merge_group:
```

**Proposed:**

```yaml
on:
  pull_request:
    types: [opened, synchronize]
  workflow_dispatch:  # Manual trigger for testing
```

**Rationale:**

- Remove `push` to `master` to avoid autofix on main branch
- Focus on PR events where autofix is most valuable
- Add `workflow_dispatch` for manual testing

### 2. Job Modifications

#### 2.1 Convert `linter` to `autofix-lint`

**Changes:**

- Replace validation commands with fix commands
- Add git configuration and commit logic
- Use appropriate tokens for pushing changes

**Implementation:**

```yaml
autofix-lint:
  runs-on: ubuntu-latest
  if: github.event_name == 'pull_request'
  permissions:
    contents: write
    pull-requests: write
  steps:
    - uses: actions/checkout@v5
      with:
        token: ${{ secrets.GITHUB_TOKEN }}
        fetch-depth: 0
    - uses: actions/setup-python@v5
      with:
        python-version: '3.11'
    - name: Install dependencies
      run: |
        python -m pip install --upgrade pip setuptools
        python -m pip install 'pylint==3.2.7' 'pycodestyle>=2.6.1' autopep8
    - name: Configure git
      run: |
        git config --local user.email "action@github.com"
        git config --local user.name "GitHub Action Autofix"
    - name: Run autofix
      run: |
        # Fix pycodestyle issues
        autopep8 --in-place --recursive --aggressive --aggressive .
        
        # Note: pylint doesn't have autofix, so we'll skip it for now
        # Future enhancement: integrate with tools like black, autopep8, etc.
    - name: Check for changes
      id: verify-changed-files
      run: |
        if [ -n "$(git status --porcelain)" ]; then
          echo "changed=true" >> $GITHUB_OUTPUT
        else
          echo "changed=false" >> $GITHUB_OUTPUT
        fi
    - name: Commit and push changes
      if: steps.verify-changed-files.outputs.changed == 'true'
      run: |
        git add .
        git commit -m "autofix: Apply pycodestyle fixes

        🤖 Generated with GitHub Actions autofix
        
        Co-Authored-By: GitHub Actions <action@github.com>"
        git push
```

#### 2.2 Convert `isort` to `autofix-isort`

**Implementation:**

```yaml
autofix-isort:
  runs-on: ubuntu-latest
  needs: autofix-lint
  if: github.event_name == 'pull_request'
  permissions:
    contents: write
    pull-requests: write
  steps:
    - uses: actions/checkout@v5
      with:
        token: ${{ secrets.GITHUB_TOKEN }}
        fetch-depth: 0
    - uses: actions/setup-python@v5
      with:
        python-version: '3.11'
    - name: Install dependencies
      run: |
        python -m pip install --upgrade pip setuptools
        python -m pip install isort
    - name: Configure git
      run: |
        git config --local user.email "action@github.com"
        git config --local user.name "GitHub Action Autofix"
    - name: Run isort autofix
      run: |
        isort .
    - name: Check for changes
      id: verify-changed-files
      run: |
        if [ -n "$(git status --porcelain)" ]; then
          echo "changed=true" >> $GITHUB_OUTPUT
        else
          echo "changed=false" >> $GITHUB_OUTPUT
        fi
    - name: Commit and push changes
      if: steps.verify-changed-files.outputs.changed == 'true'
      run: |
        git add .
        git commit -m "autofix: Apply isort import sorting

        🤖 Generated with GitHub Actions autofix
        
        Co-Authored-By: GitHub Actions <action@github.com>"
        git push
```

### 3. Testing Strategy

#### 3.1 Unit Testing

**Test Cases:**

1. **No changes needed** - Verify workflow completes without commits
2. **pycodestyle fixes** - Test with intentionally bad formatting
3. **isort fixes** - Test with unsorted imports
4. **Combined fixes** - Test with both formatting and import issues
5. **Permission errors** - Test behavior with insufficient permissions

**Test Files:**
Create test files in `spec/test-fixtures/`:

```tree
spec/test-fixtures/
├── bad_formatting.py      # pycodestyle violations
├── unsorted_imports.py    # isort violations
├── combined_issues.py     # both violations
└── clean_file.py         # no violations
```

#### 3.2 Integration Testing

**Test Plan:**

1. Create test branch with formatting issues
2. Open PR to trigger autofix workflow
3. Verify commits are made with proper messages
4. Verify fixes are actually applied
5. Verify no infinite loops or recursive triggers

**Test Commands:**

```bash
# Create test branch
git checkout -b test-autofix-$(date +%s)

# Copy test files with issues
cp spec/test-fixtures/bad_formatting.py ./test_file.py
git add test_file.py
git commit -m "Add test file with formatting issues"
git push -u origin HEAD

# Open PR and monitor workflow
gh pr create --title "Test autofix workflow" --body "Testing autofix functionality"
gh pr checks --watch
```

#### 3.3 End-to-End Testing

**Validation Steps:**

1. Verify autofix jobs run only on PRs
2. Verify jobs don't run on autofix commits (prevent recursion)
3. Verify proper git configuration and commit messages
4. Verify changes are actually pushed to PR branch
5. Verify validation jobs still run after autofix

### 4. Security Considerations

#### 4.1 Token Permissions

**Required Permissions:**

```yaml
permissions:
  contents: write    # To push commits
  pull-requests: write    # To update PR
```

**Token Selection:**

- Use `GITHUB_TOKEN` (default, recommended)
- Avoid personal access tokens unless necessary
- Consider using GitHub App tokens for enhanced security

#### 4.2 Recursion Prevention

**Strategies:**

1. Use commit message patterns to identify autofix commits
2. Add `[skip ci]` to autofix commits if needed
3. Use conditional logic: `if: !contains(github.event.head_commit.message, 'autofix:')`

#### 4.3 Branch Protection

**Recommendations:**

- Ensure autofix workflows can push to PR branches
- Consider exempting autofix bot from some branch protection rules
- Monitor for abuse or unexpected behavior

### 5. Implementation Steps

#### Phase 1: Basic Setup

1. Create backup of current `py-ci.yml`
2. Implement `autofix-lint` job
3. Test with simple formatting issues
4. Verify no recursion occurs

#### Phase 2: Expand Coverage

1. Add `autofix-isort` job
2. Test job dependencies and sequencing
3. Verify combined fixes work correctly

#### Phase 3: Enhanced Tooling

1. Consider adding black, flake8 autofix
2. Add more comprehensive formatting tools
3. Implement smarter conflict resolution

#### Phase 4: Production Deployment

1. Enable on select repositories first
2. Monitor performance and reliability
3. Gradual rollout to all applicable workflows

### 6. Monitoring and Maintenance

#### 6.1 Metrics to Track

- Number of autofix commits per week
- Types of fixes applied most frequently
- Workflow execution time
- Failure rates and common error patterns

#### 6.2 Maintenance Tasks

- Regular updates to linting tool versions
- Review and update autofix rules
- Monitor for new autofix opportunities
- Update documentation and examples

### 7. Rollback Plan

If autofix causes issues:

1. **Immediate:** Disable workflow via GitHub UI
2. **Short-term:** Revert to validation-only workflow
3. **Investigation:** Analyze logs and fix issues
4. **Recovery:** Re-enable with fixes applied

**Rollback Command:**

```bash
# Disable workflow
gh workflow disable py-ci.yml

# Revert to previous version
git checkout HEAD~1 -- .github/workflows/py-ci.yml
git commit -m "Rollback autofix workflow"
git push
```

### 8. Success Criteria

**Workflow Success:**

- ✅ Autofix runs only on PRs
- ✅ No infinite loops or recursion
- ✅ Proper commit messages and attribution
- ✅ Fixes are actually applied and work
- ✅ Validation jobs still catch real issues

**Developer Experience:**

- ✅ Reduced manual formatting work
- ✅ Consistent code style across PRs
- ✅ Clear attribution of automated changes
- ✅ No disruption to existing workflows

### 9. Future Enhancements

1. **Smart Conflict Resolution** - Handle merge conflicts in autofix commits
2. **Conditional Fixes** - Only fix files changed in the PR
3. **Review Integration** - Add autofix suggestions as PR review comments
4. **Multi-language Support** - Extend to JavaScript, TypeScript, etc.
5. **Custom Rules** - Allow repository-specific autofix configurations

---

## Appendix

### A. Example Test Files

**spec/test-fixtures/bad_formatting.py:**

```python
import os,sys
def bad_function( x,y ):
    if x==y:
        return x+y
    else:
        return x-y
```

**spec/test-fixtures/unsorted_imports.py:**

```python
import sys
import os
import collections
import abc
```

**spec/test-fixtures/clean_file.py:**

```python
import os
import sys

def clean_function(x, y):
    if x == y:
        return x + y
    else:
        return x - y
```

### B. Workflow File Template

See the complete workflow implementations in the job modification sections above.

### C. Commands Reference

```bash
# Test autofix locally
autopep8 --in-place --recursive --aggressive --aggressive .
isort .

# Check for changes
git status --porcelain

# Manual workflow trigger
gh workflow run py-ci.yml

# Monitor workflow
gh run list --workflow=py-ci.yml
gh run view <run-id>
```
