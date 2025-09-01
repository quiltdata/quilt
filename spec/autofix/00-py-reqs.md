<!-- markdownlint-disable MD013 -->
# Python CI Requirements Analysis

## Overview

This document enumerates the existing tests from the original (master) py-ci.yml workflow and defines what their autofix versions should be. The goal is to create a SINGLE unified workflow that automatically fixes ALL and ONLY files that fail the original validation tests.

## Original py-ci.yml Tests (Pre-Autofix)

### 1. linter Job
**Original Behavior:**
- Runs `pylint .` for code quality validation
- Runs `pycodestyle $(find -name '*.py' -not -path './venv/*')` for style validation
- Uses Python 3.11, pylint==3.2.7, pycodestyle>=2.6.1
- **Exit Status:** Fails CI if violations found

**Autofix Version:**
- Replace `pycodestyle` validation with `autopep8 --in-place` fixes
- Keep `pylint` as validation-only (cannot be auto-fixed)
- **Action:** Fix pycodestyle violations, validate pylint separately
- **Timing:** Run autofix BEFORE validation to ensure clean validation

### 2. isort Job
**Original Behavior:**
- Runs `isort --check --diff .` to validate import sorting
- Uses Python 3.11
- **Exit Status:** Fails CI if imports are unsorted

**Autofix Version:**
- Replace `isort --check --diff .` with `isort .` to fix import sorting
- **Action:** Auto-sort imports in all Python files
- **Timing:** Run after pycodestyle fixes to avoid conflicts

### 3. test-gendocs Job
**Original Behavior:**
- Generates documentation and checks for changes
- Runs `cd gendocs && python build.py`
- Uses `git diff --exit-code` to verify no changes
- Uses Python 3.9 (specific version requirement)
- **Exit Status:** Fails if generated docs differ from committed docs

**Autofix Version:**
- **NOT AUTO-FIXABLE** - Documentation generation should be manual/controlled
- **Action:** Keep as validation-only job
- **Rationale:** Generated docs may contain sensitive changes that need human review

### 4. test-testdocs Job
**Original Behavior:**
- Tests documentation code blocks using pytest --codeblocks
- Uses Poetry for dependency management
- Uses Python 3.11
- **Exit Status:** Fails if documentation code examples fail

**Autofix Version:**
- **NOT AUTO-FIXABLE** - Documentation tests require human intervention
- **Action:** Keep as validation-only job
- **Rationale:** Failing doc tests indicate content issues, not formatting

### 5. test-client Job
**Original Behavior:**
- Matrix testing across OS (ubuntu-latest, windows-latest) and Python versions (3.9-3.13)
- Runs `uv run pytest --cov=. .` in api/python directory
- Uploads coverage to Codecov
- **Exit Status:** Fails if any tests fail

**Autofix Version:**
- **NOT AUTO-FIXABLE** - Unit tests cannot be automatically fixed
- **Action:** Keep as validation-only job
- **Rationale:** Test failures indicate code issues, not style problems

### 6. test-lambda Job
**Original Behavior:**
- Matrix testing across 13 lambda function directories
- Complex dependency installation and testing setup
- Runs pytest with coverage for each lambda
- **Exit Status:** Fails if any lambda tests fail

**Autofix Version:**
- **NOT AUTO-FIXABLE** - Lambda tests cannot be automatically fixed
- **Action:** Keep as validation-only job
- **Rationale:** Test failures indicate functional issues

### 7. pypi-release Jobs
**Original Behavior:**
- pypi-release-tag-check: Validates git tag format for releases
- pypi-release: Publishes to PyPI on valid tags
- **Exit Status:** Fails if tag format invalid or publish fails

**Autofix Version:**
- **NOT AUTO-FIXABLE** - Release processes should remain manual/controlled
- **Action:** Keep as validation-only jobs
- **Rationale:** Publishing should never be automated without explicit human approval

## Auto-Fixable vs Validation-Only Summary

### Auto-Fixable Tests (2 total)
1. **pycodestyle violations** → `autopep8 --in-place` fixes
2. **isort import sorting** → `isort .` fixes

### Validation-Only Tests (5 categories)
1. **pylint code quality** → Cannot auto-fix complex code quality issues
2. **Documentation generation** → Requires human review for content changes
3. **Documentation testing** → Requires human intervention for content fixes
4. **Unit/integration tests** → Cannot auto-fix failing business logic
5. **Release processes** → Should remain under human control

## Unified Workflow Implementation Approach

### Sequential Execution Strategy
1. **AUTOFIX PHASE** (PR-only, with recursion prevention):
   - autofix-lint: Apply autopep8 fixes and commit
   - autofix-isort: Apply isort fixes and commit

2. **VALIDATION PHASE** (runs on fixed code):
   - linter: Validate pylint + pycodestyle on fixed code
   - isort: Validate import sorting on fixed code  
   - test-gendocs: Validate generated documentation
   - test-testdocs: Test documentation code blocks
   - test-client: Run full test suite with coverage
   - test-lambda: Test all lambda functions

3. **RELEASE PHASE** (tags only):
   - pypi-release-tag-check: Validate release tag format
   - pypi-release: Publish to PyPI

### Critical Design Principles

1. **Fix ALL and ONLY fixable issues**: Only target pycodestyle and isort violations that have deterministic fixes

2. **Sequential execution**: Autofix must complete BEFORE validation to prevent race conditions

3. **Recursion prevention**: Use `[autofix]` commit message detection to prevent infinite loops

4. **Scope limitation**: Only run autofix on Pull Requests, never on master branch or tags

5. **Preservation of existing behavior**: All original validation tests must continue to run unchanged after autofix

6. **Error isolation**: Autofix failures should not prevent validation jobs from running

## Target File Patterns

### Included Files
- All `*.py` files in repository
- Excludes: `./venv/*`, `./.venv/*`, `./env/*` (virtual environments)

### Autofix Commands
```bash
# pycodestyle fixes
find . -name '*.py' -not -path './venv/*' -not -path './.venv/*' -not -path './env/*' | \
  xargs -r autopep8 --in-place

# isort fixes  
find . -name '*.py' -not -path './venv/*' -not -path './.venv/*' -not -path './env/*' | \
  xargs -r isort
```

### Validation Commands (unchanged)
```bash
# pylint validation
pylint .

# pycodestyle validation  
pycodestyle $(find -name '*.py' -not -path './venv/*')

# isort validation
isort --check --diff .
```

## Success Criteria

1. **Comprehensive coverage**: Autofix handles ALL pycodestyle and isort violations
2. **No false positives**: Only fix files that would actually fail original validation  
3. **No missed violations**: Every file that fails original validation gets fixed
4. **Proper sequencing**: Validation always runs on fixed code, never original code
5. **Zero disruption**: All existing functionality preserved exactly as-is