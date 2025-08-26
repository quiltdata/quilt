# CI Parity with Docker

This directory contains Docker-based tools to run **identical** CI checks locally, ensuring 100% parity with GitHub Actions.

## Overview

The original Makefile targets (`make lint`, `make test`, etc.) are optimized for fast development but differ from CI in several ways:
- Different Python versions 
- Different tool versions
- Different scopes (changed files vs full repository)
- Missing environment variables and memory limits

The new CI-parity targets solve this by using Docker containers that **exactly** match the GitHub Actions environment.

## Quick Start

```bash
# Build Docker images (one-time setup)
make docker-build

# Run individual CI checks
make lint-ci        # Exact CI linting (pylint==3.2.7, full repo)
make isort-ci       # Exact CI import sorting check  
make test-ci        # Exact CI testing with coverage
make gendocs-ci     # Exact CI doc generation (Python 3.9)
make lint-docs-ci   # Exact CI doc linting (with memory limit)

# Run all CI checks at once
make ci-all

# Or use docker-compose for more control
docker-compose -f docker-compose.ci.yml run lint
docker-compose -f docker-compose.ci.yml run test
docker-compose -f docker-compose.ci.yml up    # Run all services
```

## CI Parity Mapping

| CI Job | Makefile Target | Docker Image | Exact Match |
|--------|----------------|--------------|-------------|
| `py-ci.yml:linter` | `make lint-ci` | `quilt-ci-lint` | ✅ Python 3.11, pylint==3.2.7, full repo scan |
| `py-ci.yml:isort` | `make isort-ci` | `quilt-ci-lint` | ✅ isort --check --diff on full repo |
| `py-ci.yml:test-client` | `make test-ci` | `quilt-ci-lint` | ✅ pytest --cov with environment vars |
| `py-ci.yml:test-gendocs` | `make gendocs-ci` | `quilt-gendocs` | ✅ Python 3.9, exact dependencies |
| `js-ci.yml:lint-docs` | `make lint-docs-ci` | `node:latest` | ✅ NODE_OPTIONS memory limit |

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
| **Scope** | Changed files only | Full repository |
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

```bash
# Fast development (original targets - changed files only)
make lint          # Quick linting of changed files
make test          # Fast tests

# Pre-commit CI verification (new targets - full repository)
make lint-ci       # Verify your changes pass CI linting
make test-ci       # Verify your changes pass CI tests

# Before pushing (run full CI suite)
make ci-all        # Run all CI checks locally
```

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