#!/usr/bin/env python3
"""
Verify that h5ad files can be read and processed correctly.

This script:
1. Reads the test.h5ad file using anndata
2. Calculates QC metrics using scanpy
3. Extracts gene-level data
4. Validates the data structure
"""

import sys
from pathlib import Path

try:
    import anndata as ad
    import scanpy as sc
    import pandas as pd
    import pyarrow as pa
except ImportError as e:
    print(f"✗ Missing dependency: {e}")
    print("\nInstall dependencies with:")
    print("  cd repos/h5ad-local/quilt/lambdas/tabular_preview/tests/data")
    print("  pip install -e .")
    sys.exit(1)


def verify_h5ad_file(file_path: Path):
    """Verify an h5ad file can be read and processed."""

    print(f"\n{'='*60}")
    print(f"Verifying: {file_path.name}")
    print(f"{'='*60}\n")

    # 1. Read the file
    print("1. Reading h5ad file...")
    try:
        adata = ad.read_h5ad(file_path)
        print(f"   ✓ File loaded successfully")
        print(f"   • Shape: {adata.n_obs} cells × {adata.n_vars} genes")
        print(f"   • File size: {file_path.stat().st_size:,} bytes")
    except Exception as e:
        print(f"   ✗ Failed to read file: {e}")
        return False

    # 2. Display structure
    print("\n2. Data structure:")
    print(f"   • Observations (cells): {adata.n_obs}")
    print(f"   • Variables (genes): {adata.n_vars}")
    print(f"   • obs keys: {list(adata.obs.keys())}")
    print(f"   • var keys: {list(adata.var.keys())}")
    if adata.X is not None:
        print(f"   • Expression matrix: {adata.X.shape}")

    # 3. Calculate QC metrics
    print("\n3. Calculating QC metrics with scanpy...")
    try:
        # Only calculate QC for small matrices to avoid memory issues
        n_elements = adata.n_obs * adata.n_vars
        if n_elements > 1_000_000:
            print(f"   ⚠ Matrix too large ({n_elements:,} elements), skipping QC")
            gene_data = adata.var.copy()
        else:
            sc.pp.calculate_qc_metrics(adata, percent_top=None, log1p=False, inplace=True)
            print(f"   ✓ QC metrics calculated")

            # Extract gene-level data
            gene_data = adata.var.copy()

            # Display QC columns
            qc_cols = [col for col in gene_data.columns if any(
                x in col for x in ['total_counts', 'n_cells', 'mean', 'pct_dropout']
            )]
            print(f"   • QC columns added: {qc_cols}")
    except Exception as e:
        print(f"   ✗ Failed to calculate QC: {e}")
        return False

    # 4. Display gene data sample
    print("\n4. Gene-level data sample:")
    print(gene_data.head().to_string())

    # 5. Validate Arrow conversion
    print("\n5. Testing Arrow format conversion...")
    try:
        # Reset index to make gene IDs a column
        gene_df = gene_data.reset_index()

        # Convert to Arrow
        table = pa.Table.from_pandas(gene_df)
        print(f"   ✓ Converted to Arrow table")
        print(f"   • Columns: {table.column_names}")
        print(f"   • Rows: {table.num_rows}")
        print(f"   • Size: {table.nbytes:,} bytes")
    except Exception as e:
        print(f"   ✗ Failed Arrow conversion: {e}")
        return False

    # 6. Validate metadata
    print("\n6. Metadata structure:")
    metadata = {
        'n_cells': adata.n_obs,
        'n_genes': adata.n_vars,
        'obs_keys': list(adata.obs.keys()),
        'var_keys': list(adata.var.keys()),
        'matrix_type': str(type(adata.X).__name__) if adata.X is not None else 'None',
    }

    for key, value in metadata.items():
        if isinstance(value, list):
            print(f"   • {key}: {value}")
        else:
            print(f"   • {key}: {value}")

    print(f"\n{'='*60}")
    print("✓ All validations passed!")
    print(f"{'='*60}\n")

    return True


def main():
    """Main entry point."""

    # Find test files
    test_dir = Path(__file__).parent / "simple"

    if not test_dir.exists():
        print(f"✗ Test directory not found: {test_dir}")
        sys.exit(1)

    h5ad_files = list(test_dir.glob("*.h5ad"))

    if not h5ad_files:
        print(f"✗ No h5ad files found in {test_dir}")
        sys.exit(1)

    print(f"Found {len(h5ad_files)} h5ad file(s) to verify")

    success = True
    for h5ad_file in h5ad_files:
        if not verify_h5ad_file(h5ad_file):
            success = False

    if success:
        print("\n✓ All h5ad files verified successfully!")
        sys.exit(0)
    else:
        print("\n✗ Some verifications failed")
        sys.exit(1)


if __name__ == "__main__":
    main()
