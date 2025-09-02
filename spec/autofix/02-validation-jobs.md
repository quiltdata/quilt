<!-- markdownlint-disable MD013 -->
# Non-Linter Validation Jobs

## Purpose

This document catalogs the py-ci.yml validation jobs that cannot be auto-fixed and must remain validation-only.

## Validation-Only Jobs (5 categories)

### 1. pylint code quality (py-ci.yml lines 21-23)

**Command:** `pylint .`

**Why validation-only:** Cannot auto-fix complex code quality issues, logic problems, or architectural concerns that pylint detects.

### 2. Documentation generation (test-gendocs job, py-ci.yml lines 43-82)

**Purpose:** Validates that documentation generation doesn't change files

**Why validation-only:** Requires human review for content changes. Automated changes to documentation could introduce errors or inappropriate content.

### 3. Documentation testing (test-testdocs job, py-ci.yml lines 84-107)  

**Purpose:** Tests documentation code blocks for correctness

**Why validation-only:** Requires human intervention to fix failing documentation examples. Auto-fixing could break intended examples.

### 4. Unit/integration tests (test-client job, py-ci.yml lines 109-117)

**Purpose:** Python client testing across versions and operating systems

**Why validation-only:** Cannot auto-fix failing business logic, API changes, or test failures. Requires human understanding of intended behavior.

### 5. Lambda function tests (test-lambda job, py-ci.yml lines 161-225)

**Purpose:** Tests multiple lambda functions across different configurations

**Why validation-only:** Cannot auto-fix failing business logic or deployment-specific issues. Requires human understanding of lambda functionality.

### 6. Release processes (pypi-release jobs, py-ci.yml lines 119-159)

**Purpose:** Handles PyPI package publishing and release automation

**Why validation-only:** Should remain under human control for security, versioning, and release management reasons.

## Summary

These 6 job categories require human intervention and should never be auto-fixed. They validate business logic, documentation quality, and handle sensitive operations like releases.