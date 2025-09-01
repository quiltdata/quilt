<!-- markdownlint-disable MD013 -->
# Python CI Requirements Analysis

## Purpose

This document defines WHAT needs to be automated: which existing validation tests can be auto-fixed and which must remain validation-only.

## Goal

Create a SINGLE unified workflow that automatically fixes ALL and ONLY files that fail the original py-ci.yml validation tests.

## Test Analysis

### Auto-Fixable Tests (2 types)

#### 1. pycodestyle violations

- Current: `pycodestyle $(find -name '*.py' -not -path './venv/*')` fails on style violations
- Autofix: `autopep8 --in-place` fixes violations automatically
- Tool requirements: autopep8, pycodestyle>=2.6.1, Python 3.11

#### 2. isort import sorting

- Current: `isort --check --diff .` fails on unsorted imports  
- Autofix: `isort .` sorts imports automatically
- Tool requirements: isort, Python 3.11

### Validation-Only Tests (5 categories)

**1. pylint code quality** - Cannot auto-fix complex code quality issues

**2. Documentation generation** - Requires human review for content changes

**3. Documentation testing** - Requires human intervention for content fixes

**4. Unit/integration tests** - Cannot auto-fix failing business logic

**5. Release processes** - Should remain under human control

## Technical Requirements

### File Targeting

- Include: All `*.py` files in repository
- Exclude: `./venv/*`, `./.venv/*`, `./env/*` (virtual environments)

### Execution Order

1. **AUTOFIX PHASE** (PR-only): autopep8 fixes → isort fixes
2. **VALIDATION PHASE** (all triggers): Run all original tests on fixed code
3. **RELEASE PHASE** (tags only): Maintain existing PyPI release process

### Success Criteria

1. **100% coverage**: Every pycodestyle/isort violation gets fixed
2. **Zero false positives**: Only fix files that would actually fail validation
3. **Sequential execution**: Validation always runs on fixed code
4. **Zero disruption**: All existing functionality preserved exactly
