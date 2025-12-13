# H5AD Docker Testing Tools

Quick tools to build and verify the tabular preview Lambda Docker container can read h5ad files.

This directory contains all the Docker testing tools integrated with the h5ad test data project.

## Quick Start

**Navigate to this directory first:**

```bash
cd repos/h5ad-local/quilt/lambdas/tabular_preview/tests/data
```

Then run:


```bash
make test-docker   # builds docker
```

```bash
make verify-docker  # runs verification as well
```

**Or use the Python script directly:**

```bash
./verify-h5ad-docker.py
```

## Available Make Targets

Run `make help` to see all available targets:

```sh
make help              # Show this help message
make build             # Build the Docker image
make test              # Build and run unit tests
make test-unit         # Run unit tests only (no Docker)
make test-docker       # Build and test Docker container
make verify            # Run full verification (build + Docker test + unit tests)
make verify-quick      # Run unit tests only (fastest)
make clean             # Stop container and remove Docker image
make install-deps      # Install Python dependencies for local testing
make shell             # Start a shell in the Docker container
make logs              # Show logs from running container
make start             # Start the container in the background
make stop              # Stop the running container
make invoke            # Invoke the Lambda with a test payload
make dev               # Start development environment (build + start container)
make dev-test          # Run unit tests in development mode
make rebuild           # Clean and rebuild from scratch
```

## Development Workflow

### 1. First Time Setup

**Install uv (if not already installed):**

```bash
pip install uv
# or visit: https://docs.astral.sh/uv/
```

**Install dependencies for local testing:**

```bash
make install-deps
```

This uses `uv sync --group test` to install all dependencies from the local `pyproject.toml`
(anndata, scanpy, pandas, pyarrow, pytest) in an isolated virtual environment.

### 2. Run Tests

**Option A: Unit tests only (recommended)**

```bash
make test-unit
```

This runs:

- `uv run pytest tests/test_index.py::test_preview_h5ad -v`

Validates:

- ✅ H5AD file parsing via anndata
- ✅ QC metric calculation via scanpy
- ✅ Gene-level data extraction
- ✅ Apache Arrow format serialization
- ✅ Metadata structure

**Option B: Build Docker and run unit tests**

```bash
make test
```

This:
1. Builds the Docker image (~3-5 minutes first time)
2. Runs unit tests

**Option C: Full verification (includes Docker container test)**

```bash
make verify
```

This:
1. Builds the Docker image (~3-5 minutes first time)
2. Runs unit tests
3. Starts Docker container and verifies Lambda runtime

### 3. Interactive Testing

Start a container for manual testing:

```bash
make start          # Start container in background
make logs           # View container logs
make invoke         # Send test request
make stop           # Stop container
```

Or use the combined development workflow:

```bash
make dev           # Build + start container
make dev-test      # Run unit tests
```

## Python Script Usage

The `verify-h5ad-docker.py` script provides more control:

```bash
# Full verification (default)
./verify-h5ad-docker.py

# Skip Docker build (use existing image)
./verify-h5ad-docker.py --no-build

# Only run unit tests
./verify-h5ad-docker.py --unit-tests-only

# Skip Docker container test
./verify-h5ad-docker.py --no-docker-test
```

## What Gets Tested

### Unit Tests (`make test-unit`)

✅ **File:** `repos/h5ad-local/quilt/lambdas/tabular_preview/tests/data/simple/test.h5ad`
- Shape: 2 cells × 2 genes
- Size: ~22KB
- Genes: ENSG001, ENSG002

✅ **Validates:**
1. H5AD file loading with anndata
2. QC metrics calculation via scanpy:
   - `total_counts` - Total UMI counts
   - `n_cells_by_counts` - Cells expressing gene
   - `mean_counts` - Mean expression per cell
   - `pct_dropout_by_counts` - Zero-expression percentage
3. Gene metadata extraction from `adata.var`
4. Apache Arrow format conversion
5. Response metadata structure

### Docker Container Test (`make test-docker`)

✅ **Validates:**
1. Docker image builds successfully
2. Lambda runtime initializes
3. Handler is accessible via HTTP

⚠️ **Limitations:**
- Cannot test actual S3 URL fetching (requires AWS credentials)
- Cannot test large file handling (requires S3 setup)
- Cannot test Lambda timeout/memory limits (Docker vs Lambda environment)

## Troubleshooting

### Test fails: "No such file or directory: test.h5ad"

**Solution:** Run tests from the Lambda root:

```bash
cd repos/h5ad-local/quilt/lambdas/tabular_preview
uv run pytest tests/test_index.py::test_preview_h5ad -v
```

Or use `make test-unit` which handles this automatically.

### Docker build fails: "uv: command not found"

**Solution:** Enable Docker BuildKit:

```bash
DOCKER_BUILDKIT=1 make build
```

### ImportError: No module named 't4_lambda_shared'

**Solution:** Install dependencies:

```bash
make install-deps
```

### Docker daemon not running

**Solution:** Start Docker Desktop or Docker daemon:

```bash
# macOS
open -a Docker

# Linux
sudo systemctl start docker
```

## Files

- **[verify-h5ad-docker.py](verify-h5ad-docker.py)** - Python verification script
- **[verify_h5ad.py](verify_h5ad.py)** - Standalone h5ad verification script
- **[Makefile](Makefile)** - Make targets for common workflows
- **[pyproject.toml](pyproject.toml)** - Python dependencies and project config
- **Test file:** [simple/test.h5ad](simple/test.h5ad)
- **Dockerfile:** [../../Dockerfile](../../Dockerfile)
- **Tests:** [../test_index.py](../test_index.py)

## Next Steps

After local testing succeeds:

1. **Deploy to test bucket:**
   ```bash
   ./deploy-test-lambda.py tabular_preview
   ```

2. **Integration test:** Upload h5ad file to S3, verify preview in Quilt catalog

3. **Frontend changes:** Add h5ad detection to Tabular.tsx

## Related Documentation

- [README.md](README.md) - Standalone h5ad verification (no Docker required)
- Main project documentation is in the meta repo root
