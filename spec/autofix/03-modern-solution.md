<!-- markdownlint-disable MD013 -->
# Modern Auto-Linting Solution

## Purpose

This document proposes a comprehensive modern auto-linting solution using tools like **Ruff** and **Black** to replace significant portions of the current py-ci.yml validation with auto-fixable alternatives.

## Key Insight

Modern Python tooling has evolved beyond the legacy pylint/pycodestyle/isort stack. Tools like **Ruff** can both detect AND auto-fix many issues that pylint only detects.

## Current vs Modern Tool Comparison

### Current py-ci.yml Stack

| Tool | Purpose | Auto-fix Capability | Issues |
|------|---------|---------------------|---------|
| `pylint` | Code quality analysis | ❌ None | Detection-only, requires human judgment |
| `pycodestyle` | Style violations | ❌ None | Detection-only, needs autopep8 |
| `isort` | Import sorting | ✅ Limited | Can fix own violations only |

### Modern Alternative Stack

| Tool | Purpose | Auto-fix Capability | Advantages |
|------|---------|---------------------|------------|
| `ruff check` | Linting + many pylint rules | ✅ Extensive | Fast, covers E/W/F/etc rules with fixes |
| `ruff format` | Code formatting | ✅ Complete | Black-compatible, handles all formatting |
| `black` | Code formatting | ✅ Complete | Industry standard, opinionated formatting |

## Ruff Capabilities Analysis

### What Ruff Can Auto-Fix vs Pylint/pycodestyle

**Ruff advantages:**

1. **Speed**: 10-100x faster than pylint
2. **Comprehensive**: Covers pycodestyle (E/W), pyflakes (F), and many pylint rules
3. **Auto-fixable**: Can fix most style and many logic issues automatically
4. **Single tool**: Replaces multiple tools with one fast solution

**Test Results on bad_formatting.py:**

```bash
# pycodestyle detects 8 violations, cannot fix any
pycodestyle: E231, E401, E302, E201, E231, E202, E225, W292

# ruff detects 3 violations, can fix all 3 automatically  
ruff check: E401 (split imports), F401×2 (remove unused imports)

# ruff format handles all formatting issues
ruff format: Fixes spacing, blank lines, operators automatically
```

## Proposed Modern Solution

### Phase 1: Enhanced Auto-fix (Replaces Current Jobs)

Replace current validation with modern auto-fixable alternatives:

**Instead of:**
```yaml
# Current: 3 separate validation-only jobs
- name: Run pylint        # No autofix
- name: Run pycodestyle   # No autofix  
- name: Run isort         # Limited autofix
```

**Use modern stack:**
```yaml
# Modern: 2 comprehensive autofix jobs
- name: Auto-fix with ruff
  run: |
    # Fix linting issues (replaces pylint + pycodestyle)
    ruff check --fix --diff . | patch -p0
    
- name: Auto-fix formatting
  run: |
    # Fix formatting issues (replaces autopep8 + isort)
    ruff format --diff . | patch -p0
    # OR: black --diff . | patch -p0
```

### Phase 2: Validation of Remaining Issues

Run validation on issues that still require human judgment:

```yaml
- name: Validate remaining issues
  run: |
    # Check for unfixable issues
    ruff check --no-fix .
    
    # Optional: Run pylint for deep analysis of remaining issues
    pylint --disable=fixable-rule-codes .
```

## Implementation Strategy

### Approach A: Full Replacement

**Benefits:**
- Single modern toolchain
- Much faster CI (ruff is 10-100x faster)
- More comprehensive auto-fixing
- Industry standard (ruff/black widely adopted)

**Implementation:**
```bash
# Complete autofix pipeline
ruff check --fix --diff . | patch -p0    # Fix linting issues
ruff format --diff . | patch -p0         # Fix formatting issues

# Validation of unfixable issues
ruff check --no-fix .                    # Catch remaining problems
```

### Approach B: Hybrid Solution

Keep pylint for deep analysis, use ruff for auto-fixable issues:

**Implementation:**
```bash
# Auto-fix what's possible
ruff check --fix --diff --select=E,W,F,I . | patch -p0
ruff format --diff . | patch -p0

# Validate remaining complex issues
pylint --disable=E,W . # Only run pylint for non-autofix issues
```

## Migration Path

### Step 1: Add Modern Tools

Add ruff/black to py-ci.yml alongside existing tools:

```yaml
- name: Install modern tools
  run: pip install ruff black

- name: Test ruff autofix (dry-run)
  run: ruff check --fix --diff . 

- name: Test format autofix (dry-run)  
  run: ruff format --diff .
```

### Step 2: Compare Results

Run both old and new stacks in parallel to compare:
- Which violations each catches
- Which violations can be auto-fixed
- Performance differences

### Step 3: Gradual Replacement

Replace validation-only tools with auto-fix capable modern tools:

1. Replace `pycodestyle` → `ruff check --select=E,W`
2. Replace `isort` → `ruff check --select=I` or `ruff format`
3. Optionally replace `pylint` → `ruff check --select=ALL` for auto-fixable rules

### Step 4: Configuration Alignment

Ensure ruff/black configurations match existing code style:

```toml
# pyproject.toml
[tool.ruff]
line-length = 88  # Match black default
target-version = "py39"  # Match project minimum

[tool.ruff.lint]
select = ["E", "W", "F", "I", "UP", "B", "S", "C4"]
ignore = ["E501"]  # Ignore line length (handled by formatter)

[tool.black]
line-length = 88
target-version = ['py39']
```

## Benefits Summary

### Performance
- **10-100x faster** linting with ruff vs pylint
- **Parallel execution** of multiple rule categories
- **Single tool** replaces multiple tools

### Auto-fixing Coverage
- **Style violations**: 100% auto-fixable (E/W codes)
- **Import issues**: 100% auto-fixable (I codes)  
- **Logic issues**: Many auto-fixable (F codes, unused variables, etc.)
- **Modernization**: Auto-upgrade syntax (UP codes)

### Developer Experience
- **Fewer false positives**: Modern tools have better defaults
- **Consistent formatting**: black/ruff format eliminates style debates
- **Faster feedback**: Much faster CI runs
- **Industry standard**: Aligned with modern Python ecosystem

## Risks and Mitigation

### Risk: Different Rule Set
- **Mitigation**: Run both stacks in parallel during transition
- **Mitigation**: Configure ruff to match existing pylint rules where possible

### Risk: Breaking Changes
- **Mitigation**: Start with dry-run diffs, manual review before auto-applying
- **Mitigation**: Gradual rollout, one tool at a time

### Risk: Team Adoption
- **Mitigation**: Document benefits, provide training on new tools
- **Mitigation**: Show performance improvements and reduced manual work

## Recommendation

**Start with Approach B (Hybrid)**:
1. Add ruff for auto-fixable style/import issues
2. Keep pylint for complex analysis  
3. Measure performance and coverage improvements
4. Consider full replacement (Approach A) after successful validation

This provides immediate benefits while maintaining current validation coverage during transition.