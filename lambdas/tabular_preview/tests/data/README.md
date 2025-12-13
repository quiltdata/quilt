# H5AD Test Data Verification

Standalone test project to verify h5ad files can be read and processed.

## Quick Start

```bash
# From the project root
cd repos/h5ad-local/quilt/lambdas/tabular_preview/tests/data

# Install dependencies
pip install -e .

# Run verification
python verify_h5ad.py
```

## What It Tests

The verification script validates:

1. ✅ **File Reading** - anndata can read the h5ad file
2. ✅ **QC Calculation** - scanpy can compute gene-level metrics
3. ✅ **Data Extraction** - Gene metadata is accessible
4. ✅ **Arrow Conversion** - Data converts to Apache Arrow format
5. ✅ **Metadata Structure** - All expected metadata is present

## Test Files

- `simple/test.h5ad` - Minimal test file (2 cells × 2 genes, ~22KB)

## Dependencies

- `anndata>=0.8.0` - Read h5ad files
- `scanpy>=1.8.0` - Calculate QC metrics
- `pandas>=2.0.0` - Data manipulation
- `pyarrow>=18.0.0` - Arrow format

All transitive dependencies (scipy, h5py, etc.) are installed automatically.

## Output

The script displays:

- File size and dimensions
- Data structure (obs/var keys)
- QC metrics calculated
- Sample of gene-level data
- Arrow conversion details
- Metadata structure

## Troubleshooting

### ImportError: No module named 'anndata'

**Solution:**
```bash
cd repos/h5ad-local/quilt/lambdas/tabular_preview/tests/data
pip install -e .
```

### File not found

**Solution:** Make sure you're running from the correct directory:
```bash
cd repos/h5ad-local/quilt/lambdas/tabular_preview/tests/data
python verify_h5ad.py
```

## Integration with Docker Testing

This standalone test verifies the core h5ad processing logic without requiring:
- Docker installation
- AWS credentials
- Lambda runtime environment
- Complex dependency management

For full Lambda testing with Docker, see the parent project's test suite.
