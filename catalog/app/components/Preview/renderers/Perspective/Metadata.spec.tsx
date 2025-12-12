import * as React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ThemeOptions, ThemeProvider, createMuiTheme } from '@material-ui/core/styles'

import type { Json } from 'utils/types'

import type {
  ParquetMetadata,
  H5adMetadata,
  PackageMetadata,
} from '../../loaders/Tabular'

import Metadata from './Metadata'

vi.mock('constants/config', () => ({ default: {} }))

vi.mock('components/JsonDisplay', () => ({
  default: ({ value }: { value: Json }) => (
    <div data-testid="json">{JSON.stringify(value)}</div>
  ),
}))

const theme = createMuiTheme({
  typography: {
    monospace: {
      fontFamily: 'monospace',
    },
  } as ThemeOptions['typography'],
})

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
    renderWithTheme(<Metadata className="pq" metadata={mockParquetMetadata} />)

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
    expect(screen.getByTestId('json')).toBeTruthy()
  })

  it('should render H5adMetadata with H5AD-specific fields', () => {
    renderWithTheme(<Metadata className="h5ad" metadata={mockH5adMetadata} />)

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
    const jsonDisplays = screen.getAllByTestId('json')
    expect(jsonDisplays.length).toBe(7)
  })

  it('should render PackageMetadata without caption', () => {
    renderWithTheme(<Metadata className="package" metadata={mockPackageMetadata} />)

    // Should not have a caption since PackageMetadata doesn't have created_by
    expect(screen.queryByRole('caption')).toBeFalsy()

    // Check package-specific fields
    expect(screen.getByText('Manifest version:')).toBeTruthy()
    expect(screen.getByText('1.2.3')).toBeTruthy()

    expect(screen.getByText('Workflow:')).toBeTruthy()
    expect(screen.getByTestId('json')).toBeTruthy()

    expect(screen.getByText('Message:')).toBeTruthy()
    expect(
      screen.getByText('Initial package version with comprehensive data'),
    ).toBeTruthy()
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
})
