<!-- markdownlint-disable MD013 -->
# Python Linter Autofix Requirements

## Purpose

This document defines the core autofix problem: how to automatically fix pycodestyle and isort violations that cause py-ci.yml failures.

## Goal

Create autofix capabilities for the two linter jobs in py-ci.yml that can be automatically corrected.

## Current Linter Jobs Analysis

### 1. pycodestyle violations (py-ci.yml lines 24-26)

**Current validation:**
```bash
pycodestyle $(find -name '*.py' -not -path './venv/*')
```

**Problem:** `pycodestyle` only detects violations, cannot generate fixes

**Solution:** Use `autopep8` to fix files that fail `pycodestyle` validation

### 2. isort import sorting (py-ci.yml lines 39-41)

**Current validation:**
```bash
isort --check --diff .
```

**Solution:** Can use same `isort` tool to generate and apply fixes

## Core Solution: Targeted Patch Application

### Key Insight

Use `patch` command to apply diffs, but ensure we only fix files that actually fail validation.

### Implementation

**For isort (identical tool):**

```bash
isort --check --diff . | patch -p0
```

**For pycodestyle (custom script ensures scope alignment):**

```bash
# Get files that actually fail pycodestyle validation
failing_files=$(pycodestyle $(find -name '*.py' -not -path './venv/*') | cut -d':' -f1 | sort -u)
if [ -n "$failing_files" ]; then
    echo "$failing_files" | xargs autopep8 --diff | patch -p0
fi
```

### Success Criteria

1. **100% scope alignment**: Only fix files that would cause validation failure
2. **Zero false positives**: Cannot fix files that pass validation  
3. **Transparency**: All changes visible as diffs before applying
4. **Tool consistency**: Use exact same commands as py-ci.yml validation where possible
