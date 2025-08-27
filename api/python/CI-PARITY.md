# CI Parity with Docker

This directory contains Docker-based tools to run **identical** CI checks
locally, ensuring 100% parity with GitHub Actions.

## Overview

The original Makefile targets (`make lint`, `make test`, etc.) are
optimized for fast development but differ from CI in several ways:

- Different Python versions
- Different tool versions
- Different scopes (changed files vs full repository)
- Missing environment variables and memory limits

The new CI-parity targets solve this by using Docker containers that
**exactly** match the GitHub Actions environment.

## Quick Start

```bash
# One-time setup
make docker-build   # Build Docker images

# Development workflow
make isort          # Fix import sorting (auto-fix, CI-identical)
make lint           # Check linting (pylint==3.2.7, full repo) 
make test-full      # Run tests with coverage (CI-identical)
make ci-all         # Run all CI checks at once

# Docker compose alternative
docker-compose -f docker-compose.ci.yml run lint
docker-compose -f docker-compose.ci.yml up    # Run all services

# Still available for local testing
make test           # Quick local test run (faster, not CI-identical)
```

## CI Parity Mapping

| CI Job | Target | Image | Match |
|--------|--------|-------|-------|
| `py-ci:linter` | `lint-ci` | `quilt-ci-lint` | ✅ Py3.11 pylint==3.2.7 |
| `py-ci:isort` | `isort-ci` | `quilt-ci-lint` | ✅ isort --check |
| `py-ci:test-client` | `test-ci` | `quilt-ci-lint` | ✅ pytest --cov |
| `py-ci:test-gendocs` | `gendocs-ci` | `quilt-gendocs` | ✅ Py3.9 exact deps |
| `js-ci:lint-docs` | `lint-docs-ci` | `node:latest` | ✅ NODE_OPTIONS |

## Docker Images

### `quilt-ci-lint` (ci-python.Dockerfile)

- **Base**: Ubuntu latest
- **Python**: 3.11 (matches CI)  
- **Tools**: pylint==3.2.7, pycodestyle>=2.6.1, isort (exact CI versions)
- **Environment**: QUILT_DISABLE_USAGE_METRICS=true

### `quilt-gendocs` (gendocs.Dockerfile)

- **Base**: Ubuntu latest
- **Python**: 3.9 (matches CI test-gendocs job)
- **Tools**: nbconvert, pydoc-markdown@v2.0.5+quilt3.2 (exact CI versions)
- **Environment**: QUILT_DISABLE_USAGE_METRICS=true

## Key Differences from Original Makefile

| Aspect | Original Makefile | CI-Parity Targets |
|--------|------------------|-------------------|
| **Python Version** | System default | 3.11 (lint/test), 3.9 (gendocs) |
| **Tool Versions** | Latest (`--upgrade`) | Pinned (pylint==3.2.7) |
| **Scope** | Changed files only | Repository root (like CI) |
| **Working Directory** | api/python | Repository root (like CI) |
| **Environment** | Host system | Containerized with exact CI env |
| **Memory Limits** | None | 4GB for markdownlint (matches CI) |
| **Dependencies** | Host-installed | Container-isolated |

## Benefits

1. **100% CI Reproduction**: Debug CI failures locally with identical environment
2. **No Host Pollution**: All dependencies contained in Docker images  
3. **Consistent Results**: Same behavior across all developer machines
4. **Fast Debugging**: No need to push commits to test CI fixes
5. **Environment Isolation**: No conflicts with host Python installations

## Development Workflow

### Recommended Workflow - Fix Then Check

```bash
# 1. Fix what can be auto-fixed
make isort         # Fix import sorting (CI-identical)

# 2. Check remaining issues  
make lint          # Check linting (shows remaining manual fixes needed)
make test-full     # Test with coverage (or 'make test' for speed)

# 3. Before pushing - verify CI will pass
make ci-all        # Run all CI checks locally
git push           # No surprises in CI
```

### Available Commands

```bash
# CI-identical tools (recommended for all development)
make isort         # Fix import sorting (auto-fix, CI-identical)
make lint          # Check linting (pylint==3.2.7, Python 3.11)
make test-full     # Run tests with coverage (CI-identical)
make ci-all        # All main CI checks (lint + test-full)

# Local alternatives (faster but less accurate)
make test          # Quick local test run
make gendocs       # Local doc generation (pyenv-based)
make lint-docs     # Local doc linting
```

### What Each Tool Does

- **`isort`**: Import statement sorting and formatting ✅ Auto-fixable
- **`pycodestyle`**: PEP8 compliance checking (reports issues for manual fixing)
- **`pylint`**: Code quality, style, and potential bugs (reports issues
  for manual fixing)
- **`pytest`**: Test execution with coverage reporting

## Docker Compose Services

The `docker-compose.ci.yml` file provides individual services for each CI check:

```bash
# Individual services
docker-compose -f docker-compose.ci.yml run lint
docker-compose -f docker-compose.ci.yml run isort  
docker-compose -f docker-compose.ci.yml run test
docker-compose -f docker-compose.ci.yml run gendocs
docker-compose -f docker-compose.ci.yml run lint-docs
docker-compose -f docker-compose.ci.yml run testdocs

# Run all checks in parallel
docker-compose -f docker-compose.ci.yml up
```

## Troubleshooting

### Docker Build Issues

```bash
# Clean build (if images are stale)
docker system prune -f
make docker-build
```

### Permission Issues

```bash
# Ensure Docker has access to the workspace
docker run --rm -v $(pwd):/test alpine ls -la /test
```

### Memory Issues

```bash
# Increase Docker memory limit in Docker Desktop settings
# Default 4GB memory limit matches CI environment
```

## Future Enhancements

- **Multi-platform**: Add ARM64 support for Apple Silicon
- **Caching**: Implement layer caching for faster builds  
- **Parallel**: Run CI checks in parallel via compose
- **Matrix**: Support Python version matrix like CI (3.9-3.13)
