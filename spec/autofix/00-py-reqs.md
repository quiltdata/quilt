<!-- markdownlint-disable MD013 -->
# Python CI Requirements Analysis

## Purpose

This document defines WHAT needs to be automated: which existing validation tests can be auto-fixed and which must remain validation-only.

## Goal

Create autofix capabilities for the existing py-ci.yml validation tests that currently fail on style violations.

## Test Analysis

### Auto-Fixable Tests (2 types)

#### 1. pycodestyle violations

- Current: `pycodestyle $(find -name '*.py' -not -path './venv/*')` fails on style violations
- Autofix approach A: `autopep8 --in-place` fixes violations automatically
- Autofix approach B: `autopep8 --diff | patch -p0` applies exact same fixes using patch
- Tool requirements: autopep8, pycodestyle>=2.6.1, Python 3.11

#### 2. isort import sorting

- Current: `isort --check --diff .` fails on unsorted imports  
- Autofix approach A: `isort .` sorts imports automatically
- Autofix approach B: `isort --check --diff . | patch -p0` applies exact same fixes using patch
- Tool requirements: isort, Python 3.11

### Validation-Only Tests (6 categories)

**1. pylint code quality** - Cannot auto-fix complex code quality issues (lines 21-23)

**2. Documentation generation** - Requires human review for content changes (test-gendocs job, lines 43-82)

**3. Documentation testing** - Requires human intervention for content fixes (test-testdocs job, lines 84-107)

**4. Unit/integration tests** - Cannot auto-fix failing business logic (test-client job, lines 109-117)

**5. Lambda function tests** - Cannot auto-fix failing business logic (test-lambda job, lines 161-225)

**6. Release processes** - Should remain under human control (pypi-release jobs, lines 119-159)

## Technical Requirements

### File Targeting

- Include: All `*.py` files in repository
- Exclude: `./venv/*`, `./.venv/*`, `./env/*` (virtual environments)

### Current Workflow Analysis

**Current py-ci.yml jobs (validation-only):**

1. **linter** job (lines 10-26):
   - Runs `pylint .` (line 23) 
   - Runs `pycodestyle $(find -name '*.py' -not -path './venv/*')` (line 26)

2. **isort** job (lines 28-41):
   - Runs `isort --check --diff .` (line 41)

3. **test-gendocs** job (lines 43-82): Documentation generation validation
4. **test-testdocs** job (lines 84-107): Documentation testing  
5. **test-client** job (lines 109-117): Python client testing across versions/OS
6. **test-lambda** job (lines 161-225): Lambda function testing
7. **pypi-release** jobs (lines 119-159): PyPI release automation

### Proposed Execution Order

1. **AUTOFIX PHASE** (PR-only): Fix violations from linter/isort jobs
   - Approach A: `autopep8 --in-place` → `isort .`
   - Approach B: `autopep8 --diff | patch -p0` → `isort --check --diff . | patch -p0`
2. **VALIDATION PHASE** (all triggers): Run all original py-ci.yml jobs unchanged
3. **RELEASE PHASE** (tags only): Maintain existing PyPI release process

### Patch-Based Autofix Analysis

**SOLUTION FOUND**: Use `patch` to apply diffs from existing lint tools without introducing new tools.

#### Technical Implementation

Both `autopep8 --diff` and `isort --check --diff` generate standard unified diff format:

```bash
# Generate and apply autopep8 fixes (matches pycodestyle scope from line 26)
find . -name '*.py' -not -path './venv/*' | xargs autopep8 --diff | patch -p0

# Generate and apply isort fixes (matches isort scope from line 41)
isort --check --diff . | patch -p0
```

#### Advantages of Patch Approach

1. **Tool Consistency**: Uses identical tools for validation and fixing
2. **Scope Guarantee**: Patch can only apply changes that diff detects
3. **Transparency**: Shows exact changes that would be applied
4. **No Scope Drift**: Eliminates risk of fix/validate tool mismatches
5. **Smaller Commits**: Only changes files that actually have violations

#### Implementation Notes

- Both tools generate patch-compatible unified diff format
- `patch -p0` applies patches with original file paths
- Error handling: `patch` will fail if diffs don't apply cleanly
- Same file targeting: Identical path filters for both generation and validation

### Success Criteria

1. **100% coverage**: Every pycodestyle/isort violation gets fixed
2. **Zero false positives**: Only fix files that would actually fail validation
3. **Sequential execution**: Validation always runs on fixed code
4. **Zero disruption**: All existing functionality preserved exactly
