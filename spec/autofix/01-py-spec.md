<!-- markdownlint-disable MD013 -->
# GitHub Actions Autofix Specification

## Overview

This specification outlines the creation of a NEW autofix workflow (`py-autofix.yml`) that automatically corrects linting issues, formatting problems, and other fixable errors, then commits and pushes changes back to the repository. The existing `py-ci.yml` workflow will remain unchanged to preserve validation-only functionality and existing checks.

## Current State Analysis

The existing `py-ci.yml` workflow contains these validation jobs:

1. **linter** - Runs `pylint` and `pycodestyle` (lines 21-26)
2. **isort** - Checks import sorting with `isort --check --diff` (lines 39-41)
3. **test-gendocs** - Validates generated documentation
4. **test-testdocs** - Tests documentation code blocks
5. **test-client** - Matrix testing across Python versions and OS
6. **test-lambda** - Tests multiple lambda functions
7. **pypi-release** - Handles PyPI publishing

**Critical Requirements:**

- DO NOT modify existing `py-ci.yml` workflow
- DO NOT break existing validation jobs
- CREATE separate `py-autofix.yml` workflow
- VALIDATE that GITHUB_TOKEN has sufficient permissions
- ENSURE no conflicts with existing branch protection rules

## Assumptions Validation

### Verified Assumptions ✅

1. **GITHUB_TOKEN exists**: Default GitHub Actions secret (always available)
2. **Repository secrets**: CODECOV_TOKEN, PYPI_USERNAME, PYPI_PASSWORD exist for existing workflow
3. **Python files present**: Found Python files in `api/python/` directory structure
4. **Existing workflow intact**: Current `py-ci.yml` has proper validation jobs that must remain unchanged
5. **uv usage**: Existing workflow uses `uv` for dependency management in test jobs

### Critical Dependencies ⚠️

1. **Branch protection rules**: Must verify autofix commits are allowed
2. **Token permissions**: GITHUB_TOKEN must have `contents: write` permission on PR branches
3. **Workflow file paths**: Autofix jobs must exclude virtual environments (`./venv/*`, `./.venv/*`, `./env/*`)
4. **Python version consistency**: Use Python 3.11 to match existing linter job
5. **Tool versions**: Match existing tool versions where possible (`pycodestyle>=2.6.1`)

### Assumptions to Test 🧪

1. **No infinite recursion**: Commit message filtering prevents autofix loops
2. **Job ordering**: Sequential jobs (lint → isort) work correctly with git pulls
3. **File targeting**: Find commands correctly identify Python files while excluding test fixtures
4. **Permissions scope**: Actions can push to PR branches without additional configuration

### Preservation of Existing Workflows 🛡️

**Non-negotiable Requirements:**

1. **Keep `py-ci.yml` unchanged**: All existing jobs must continue to function exactly as they do now
   - `linter` job continues running `pylint` and `pycodestyle` validation  
   - `isort` job continues running `isort --check --diff` validation
   - All test jobs (`test-client`, `test-lambda`, etc.) remain untouched
   - PyPI release pipeline stays intact

2. **No workflow name conflicts**: New autofix workflow uses distinct name (`py-autofix.yml`)

3. **No job name conflicts**: Autofix jobs use `autofix-*` prefix to avoid collisions

4. **Complementary operation**: Autofix workflow SUPPLEMENTS existing validation, doesn't replace it

**Validation Strategy:**

- Existing `py-ci.yml` continues to catch issues that autofix cannot resolve
- Autofix reduces manual work for easily correctable issues
- Both workflows can run concurrently on PRs

## Autofix Implementation Plan

### 1. Workflow Triggers

**New `py-autofix.yml` Triggers:**

```yaml
name: Python Autofix
on:
  pull_request:
    types: [opened, synchronize, reopened]
    paths:
      - '**.py'
      - '.github/workflows/py-autofix.yml'
  workflow_dispatch:  # Manual trigger for testing
```

**Rationale:**

- Target only PRs where autofix provides value
- Use `paths` filter to run only when Python files change
- Include workflow file itself for testing
- Add `reopened` to handle closed/reopened PRs
- Manual trigger for testing and debugging

**Recursion Prevention:**

- Use commit message pattern detection
- Skip if last commit contains "[autofix]"
- Implement proper conditional logic

### 2. Job Modifications

#### 2.1 Create `autofix-lint` Job (NEW - not converted)

**Changes:**

- Replace validation commands with fix commands
- Add git configuration and commit logic
- Use appropriate tokens for pushing changes

**Implementation:**

```yaml
autofix-lint:
  runs-on: ubuntu-latest
  if: |
    github.event_name == 'pull_request' && 
    !contains(github.event.pull_request.head.sha, '[autofix]') &&
    !contains(github.event.head_commit.message, '[autofix]')
  permissions:
    contents: write
    pull-requests: write
  steps:
    - uses: actions/checkout@v5
      with:
        token: ${{ secrets.GITHUB_TOKEN }}
        fetch-depth: 0
        ref: ${{ github.head_ref }}
    - uses: actions/setup-python@v5
      with:
        python-version: '3.11'
    - name: Install dependencies
      run: |
        python -m pip install --upgrade pip setuptools
        python -m pip install autopep8 'pycodestyle>=2.6.1'
    - name: Configure git
      run: |
        git config --local user.email "action@github.com"
        git config --local user.name "GitHub Actions Autofix"
    - name: Run autopep8 fixes
      run: |
        # Focus on Python files, exclude virtual environments
        find . -name '*.py' -not -path './venv/*' -not -path './.venv/*' -not -path './env/*' | \
          xargs autopep8 --in-place --aggressive --aggressive
    - name: Check for changes
      id: verify-changed-files
      run: |
        if [ -n "$(git status --porcelain)" ]; then
          echo "changed=true" >> $GITHUB_OUTPUT
          echo "Files changed:"
          git status --porcelain
        else
          echo "changed=false" >> $GITHUB_OUTPUT
          echo "No changes detected"
        fi
    - name: Commit and push changes
      if: steps.verify-changed-files.outputs.changed == 'true'
      run: |
        git add .
        git commit -m "[autofix] Apply pycodestyle formatting fixes

        🤖 Generated with GitHub Actions autofix
        
        Co-Authored-By: GitHub Actions <action@github.com>"
        git push origin ${{ github.head_ref }}
```

#### 2.2 Create `autofix-isort` Job (NEW - not converted)

**Implementation:**

```yaml
autofix-isort:
  runs-on: ubuntu-latest
  needs: autofix-lint
  if: |
    github.event_name == 'pull_request' && 
    !contains(github.event.pull_request.head.sha, '[autofix]') &&
    !contains(github.event.head_commit.message, '[autofix]') &&
    (success() || failure())  # Run even if autofix-lint fails
  permissions:
    contents: write
    pull-requests: write
  steps:
    - uses: actions/checkout@v5
      with:
        token: ${{ secrets.GITHUB_TOKEN }}
        fetch-depth: 0
        ref: ${{ github.head_ref }}
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
        git config --local user.name "GitHub Actions Autofix"
    - name: Run isort autofix
      run: |
        # Apply isort to Python files, excluding virtual environments
        find . -name '*.py' -not -path './venv/*' -not -path './.venv/*' -not -path './env/*' | \
          xargs isort
    - name: Check for changes
      id: verify-changed-files
      run: |
        if [ -n "$(git status --porcelain)" ]; then
          echo "changed=true" >> $GITHUB_OUTPUT
          echo "Files changed:"
          git status --porcelain
        else
          echo "changed=false" >> $GITHUB_OUTPUT
          echo "No changes detected"
        fi
    - name: Commit and push changes
      if: steps.verify-changed-files.outputs.changed == 'true'
      run: |
        git add .
        git commit -m "[autofix] Apply isort import sorting

        🤖 Generated with GitHub Actions autofix
        
        Co-Authored-By: GitHub Actions <action@github.com>"
        git push origin ${{ github.head_ref }}
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
  contents: write         # To push commits to PR branch
  pull-requests: write    # To update PR (if needed)
  actions: read          # To read workflow status
```

**Token Validation:**

- ✅ GITHUB_TOKEN exists (default GitHub secret)
- ✅ Has sufficient permissions for PR branch pushes
- ❌ Personal access tokens not needed for this workflow
- ⚠️  Verify branch protection rules allow autofix commits

**Security Notes:**

- GITHUB_TOKEN is automatically scoped to the repository
- Permissions are further limited by the `permissions` block
- Actions run in isolated environment with minimal access

#### 4.2 Recursion Prevention

**Primary Strategy - Commit Message Detection:**

```yaml
if: |
  github.event_name == 'pull_request' && 
  !contains(github.event.pull_request.head.sha, '[autofix]') &&
  !contains(github.event.head_commit.message, '[autofix]')
```

**Backup Strategies:**

1. **Actor-based detection:** Skip if `github.actor == 'github-actions[bot]'`
2. **Time-based throttling:** Limit autofix frequency per PR
3. **File change detection:** Only run if source files changed, not just autofix commits

**Implementation Notes:**

- Use `[autofix]` prefix in commit messages (not `autofix:`)
- Check both commit message and commit SHA contexts
- Implement multiple layers of protection

#### 4.3 Branch Protection

**Recommendations:**

- Ensure autofix workflows can push to PR branches
- Consider exempting autofix bot from some branch protection rules
- Monitor for abuse or unexpected behavior

### 5. Implementation Steps

#### Phase 1: Workflow Creation

1. **DO NOT** modify existing `py-ci.yml`
2. Create NEW workflow file `.github/workflows/py-autofix.yml`
3. Implement basic autofix-lint job
4. Test with controlled PR scenarios
5. Verify no recursion occurs

#### Phase 2: Enhanced Jobs

1. Add autofix-isort job with proper dependencies
2. Test job sequencing and error handling
3. Verify combined fixes work correctly
4. Test edge cases (no changes, multiple commits)

#### Phase 3: Validation & Security

1. Validate branch protection compatibility
2. Test token permissions and access
3. Verify existing CI workflows still function
4. Document any conflicts or limitations

#### Phase 4: Controlled Rollout

1. Test on feature branches first
2. Monitor for unintended side effects
3. Gather feedback from development team
4. Iterate based on real-world usage

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

**Rollback Commands:**

```bash
# Disable autofix workflow (keeps py-ci.yml intact)
gh workflow disable py-autofix.yml

# Or completely remove autofix workflow
rm .github/workflows/py-autofix.yml
git add .github/workflows/py-autofix.yml
git commit -m "Remove autofix workflow"
git push

# py-ci.yml remains untouched - no rollback needed
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

### B. Complete Workflow File Template

**`.github/workflows/py-autofix.yml`:**

```yaml
name: Python Autofix

on:
  pull_request:
    types: [opened, synchronize, reopened]
    paths:
      - '**.py'
      - '.github/workflows/py-autofix.yml'
  workflow_dispatch:

jobs:
  autofix-lint:
    runs-on: ubuntu-latest
    if: |
      github.event_name == 'pull_request' && 
      !contains(github.event.pull_request.head.sha, '[autofix]') &&
      !contains(github.event.head_commit.message, '[autofix]')
    permissions:
      contents: write
      pull-requests: write
    steps:
      - uses: actions/checkout@v5
        with:
          token: ${{ secrets.GITHUB_TOKEN }}
          fetch-depth: 0
          ref: ${{ github.head_ref }}
      - uses: actions/setup-python@v5
        with:
          python-version: '3.11'
      - name: Install dependencies
        run: |
          python -m pip install --upgrade pip setuptools
          python -m pip install autopep8 'pycodestyle>=2.6.1'
      - name: Configure git
        run: |
          git config --local user.email "action@github.com"
          git config --local user.name "GitHub Actions Autofix"
      - name: Run autopep8 fixes
        run: |
          find . -name '*.py' -not -path './venv/*' -not -path './.venv/*' -not -path './env/*' | \
            xargs autopep8 --in-place --aggressive --aggressive
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
          git commit -m "[autofix] Apply pycodestyle formatting fixes

          🤖 Generated with GitHub Actions autofix
          
          Co-Authored-By: GitHub Actions <action@github.com>"
          git push origin ${{ github.head_ref }}

  autofix-isort:
    runs-on: ubuntu-latest
    needs: autofix-lint
    if: |
      github.event_name == 'pull_request' && 
      !contains(github.event.pull_request.head.sha, '[autofix]') &&
      !contains(github.event.head_commit.message, '[autofix]') &&
      (success() || failure())
    permissions:
      contents: write
      pull-requests: write
    steps:
      - uses: actions/checkout@v5
        with:
          token: ${{ secrets.GITHUB_TOKEN }}
          fetch-depth: 0
          ref: ${{ github.head_ref }}
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
          git config --local user.name "GitHub Actions Autofix"
      - name: Run isort autofix
        run: |
          find . -name '*.py' -not -path './venv/*' -not -path './.venv/*' -not -path './env/*' | \
            xargs isort
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
          git commit -m "[autofix] Apply isort import sorting

          🤖 Generated with GitHub Actions autofix
          
          Co-Authored-By: GitHub Actions <action@github.com>"
          git push origin ${{ github.head_ref }}
```

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
