import * as React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ThemeOptions, ThemeProvider, createMuiTheme } from '@material-ui/core/styles'

import type {
  ParquetMetadata,
  H5adMetadata,
  PackageMetadata,
} from '../../loaders/Tabular'

import Metadata from './Metadata'

vi.mock('constants/config', () => ({ default: {} }))

// Mock JsonDisplay component
vi.mock('components/JsonDisplay', () => ({
  default: ({ value }: { value: any }) => (
    <div data-testid="json-display">{JSON.stringify(value)}</div>
  ),
}))

// Create a minimal theme for Material-UI components
const theme = createMuiTheme({
  typography: {
    monospace: {
      fontFamily: 'Consolas, Monaco, "Courier New", monospace',
    },
  } as ThemeOptions['typography'],
  spacing: (factor: number) => `${8 * factor}px`,
})

// Helper function to wrap components with theme provider
function renderWithTheme(component: React.ReactElement) {
  return render(<ThemeProvider theme={theme}>{component}</ThemeProvider>)
}

describe('components/Preview/renderers/Perspective/Metadata', () => {
  const mockParquetMetadata: ParquetMetadata = {
    created_by: 'Apache Parquet Writer v1.0',
    format_version: '1.0',
    num_row_groups: 5,
    schema: {
      names: ['id', 'name', 'value'],
    },
    serialized_size: 1024000,
    shape: [10000, 3],
  }

  const mockH5adMetadata: H5adMetadata = {
    created_by: 'scanpy==1.9.1',
    format_version: 'h5ad',
    num_row_groups: 1,
    schema: {
      names: ['gene_id', 'gene_name', 'expression'],
    },
    serialized_size: 2048000,
    shape: [5000, 2000],
    h5ad_obs_keys: ['cell_type', 'tissue'],
    h5ad_var_keys: ['gene_symbol', 'chromosome'],
    h5ad_uns_keys: ['pca', 'neighbors'],
    h5ad_obsm_keys: ['X_pca', 'X_umap'],
    h5ad_varm_keys: ['PCs'],
    h5ad_layers_keys: ['raw', 'normalized'],
    anndata_version: '0.8.0',
    n_cells: 5000,
    n_genes: 2000,
    matrix_type: 'sparse',
    has_raw: true,
  }

  const mockPackageMetadata: PackageMetadata = {
    version: '1.2.3',
    workflow: {
      is_valid: true,
      config: {
        name: 'test-workflow',
        metadata_schema: {},
      },
    },
    message: 'Initial package version with comprehensive data',
  }

  it('should render ParquetMetadata with caption and fields', () => {
    renderWithTheme(<Metadata className="test-class" metadata={mockParquetMetadata} />)

    // Check caption is rendered
    expect(screen.getByText('Apache Parquet Writer v1.0')).toBeTruthy()

    // Check specific fields are rendered
    expect(screen.getByText('Format version:')).toBeTruthy()
    expect(screen.getByText('1.0')).toBeTruthy()

    expect(screen.getByText('# row groups:')).toBeTruthy()
    expect(screen.getByText('5')).toBeTruthy()

    expect(screen.getByText('Shape:')).toBeTruthy()
    expect(screen.getByText('10000 rows × 3 columns')).toBeTruthy()

    expect(screen.getByText('Serialized size:')).toBeTruthy()
    expect(screen.getByText('1024000')).toBeTruthy()

    // Check JsonDisplay is used for schema
    expect(screen.getByText('Schema:')).toBeTruthy()
    expect(screen.getByTestId('json-display')).toBeTruthy()
  })

  it('should render H5adMetadata with H5AD-specific fields', () => {
    renderWithTheme(<Metadata className="test-class" metadata={mockH5adMetadata} />)

    // Check caption
    expect(screen.getByText('scanpy==1.9.1')).toBeTruthy()

    // Check H5AD-specific fields
    expect(screen.getByText('Cells:')).toBeTruthy()
    expect(screen.getByText('5000')).toBeTruthy()

    expect(screen.getByText('Genes:')).toBeTruthy()
    expect(screen.getByText('2000')).toBeTruthy()

    expect(screen.getByText('Matrix type:')).toBeTruthy()
    expect(screen.getByText('sparse')).toBeTruthy()

    expect(screen.getByText('Has raw data:')).toBeTruthy()
    expect(screen.getByText('✓')).toBeTruthy()

    expect(screen.getByText('AnnData version:')).toBeTruthy()
    expect(screen.getByText('0.8.0')).toBeTruthy()

    // Check array fields are rendered with JsonDisplay
    expect(screen.getByText('Cell metadata keys:')).toBeTruthy()
    expect(screen.getByText('Gene metadata keys:')).toBeTruthy()
    expect(screen.getByText('Cell embeddings:')).toBeTruthy()
    expect(screen.getByText('Expression layers:')).toBeTruthy()

    // Should have multiple JsonDisplay components for arrays
    const jsonDisplays = screen.getAllByTestId('json-display')
    expect(jsonDisplays.length).toBeGreaterThan(1)
  })

  it('should render PackageMetadata without caption (no created_by)', () => {
    renderWithTheme(<Metadata className="test-class" metadata={mockPackageMetadata} />)

    // Should not have a caption since PackageMetadata doesn't have created_by
    expect(screen.queryByRole('caption')).toBeFalsy()

    // Check package-specific fields
    expect(screen.getByText('Manifest version:')).toBeTruthy()
    expect(screen.getByText('1.2.3')).toBeTruthy()

    expect(screen.getByText('Workflow:')).toBeTruthy()
    expect(screen.getByTestId('json-display')).toBeTruthy()

    expect(screen.getByText('Message:')).toBeTruthy()
    expect(
      screen.getByText('Initial package version with comprehensive data'),
    ).toBeTruthy()
  })

  it('should render ParquetMetadata with created_by when present', () => {
    const parquetWithCreatedBy: ParquetMetadata = {
      ...mockParquetMetadata,
      created_by: 'quilt3==3.4.0',
    }

    renderWithTheme(<Metadata className="test-class" metadata={parquetWithCreatedBy} />)

    // Should have caption when created_by is present
    expect(screen.getByText('quilt3==3.4.0')).toBeTruthy()
  })

  it('should handle boolean values correctly', () => {
    const h5adWithFalse: H5adMetadata = {
      ...mockH5adMetadata,
      has_raw: false,
    }

    renderWithTheme(<Metadata className="test-class" metadata={h5adWithFalse} />)

    expect(screen.getByText('Has raw data:')).toBeTruthy()
    expect(screen.getByText('✗')).toBeTruthy()
  })

  it('should only render fields that are not null/undefined', () => {
    const partialMetadata: Partial<H5adMetadata> = {
      created_by: 'test',
      n_cells: 1000,
      // Other fields are undefined/null and should not be rendered
    }

    renderWithTheme(
      <Metadata className="test-class" metadata={partialMetadata as H5adMetadata} />,
    )

    expect(screen.getByText('Cells:')).toBeTruthy()
    expect(screen.getByText('1000')).toBeTruthy()

    // Fields that are null/undefined should not be rendered
    expect(screen.queryByText('Genes:')).toBeFalsy()
    expect(screen.queryByText('Format version:')).toBeFalsy()
  })

  it('should apply the provided className', () => {
    const { container } = renderWithTheme(
      <Metadata className="custom-test-class" metadata={mockParquetMetadata} />,
    )

    const table = container.querySelector('table')
    expect(table?.classList.contains('custom-test-class')).toBeTruthy()
  })

  it('should render monospace strings with correct styling', () => {
    renderWithTheme(<Metadata className="test-class" metadata={mockParquetMetadata} />)

    const formatVersionValue = screen.getByText('1.0')
    expect(formatVersionValue.tagName).toBe('SPAN')
    // The mono styling is applied via CSS class, so we just check it's wrapped in a span
  })

  it('should handle empty arrays in H5AD metadata', () => {
    const h5adWithEmptyArrays: H5adMetadata = {
      ...mockH5adMetadata,
      h5ad_obs_keys: [],
      h5ad_var_keys: [],
      h5ad_layers_keys: [],
    }

    renderWithTheme(<Metadata className="test-class" metadata={h5adWithEmptyArrays} />)

    // Empty arrays should still render the field labels
    expect(screen.getByText('Cell metadata keys:')).toBeTruthy()
    expect(screen.getByText('Gene metadata keys:')).toBeTruthy()
    expect(screen.getByText('Expression layers:')).toBeTruthy()
  })
})
