import * as React from 'react'
import { render, cleanup } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ThemeOptions, ThemeProvider, createMuiTheme } from '@material-ui/core/styles'

import type { Json } from 'utils/types'

import type { ParquetMetadata } from '../../loaders/Tabular'

// `utils/perspective` loads the table inside an async effect, so a parse or
// worker failure cannot surface as a return value -- it is rethrown during the
// next render. Absent a boundary between that throw and `Errors.ErrorBoundary`
// in app.tsx, one unreadable file replaces the whole catalog with the app-level
// error screen. These tests fail the load and assert the failure stays local,
// and that the metadata panel -- which does not depend on the table -- renders
// either way.

vi.mock('constants/config', () => ({ default: {} }))

vi.mock('components/JsonDisplay', () => ({
  default: ({ value }: { value: Json }) => (
    <div data-testid="json">{JSON.stringify(value)}</div>
  ),
}))

const use = vi.fn()

vi.mock('utils/perspective', () => ({
  use: (...args: unknown[]) => use(...args),
}))

import Perspective from './Perspective'

const theme = createMuiTheme({
  typography: {
    monospace: {
      fontFamily: 'monospace',
    },
  } as ThemeOptions['typography'],
})

const meta: ParquetMetadata = {
  created_by: 'Apache Parquet Writer v1.0',
  format_version: '1.0',
  num_row_groups: 5,
  schema: {
    names: ['id', 'name', 'value'],
  },
  serialized_size: 1024000,
  shape: [10000, 3],
}

function renderPerspective() {
  return render(
    <ThemeProvider theme={theme}>
      <Perspective data="a,b\n1,2" meta={meta} truncated={false} />
    </ThemeProvider>,
  )
}

describe('components/Preview/renderers/Perspective boundary', () => {
  let consoleError: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    cleanup()
    consoleError.mockRestore()
    use.mockReset()
  })

  it('renders the fallback when the table fails to load', () => {
    use.mockImplementation(() => {
      throw new Error('could not parse')
    })

    const { getByText, getByTestId } = renderPerspective()

    expect(getByText('Could not render tabular data')).toBeTruthy()
    // the metadata panel does not depend on the table, so it must survive
    expect(getByTestId('json')).toBeTruthy()
  })

  it('renders the toolbar when the table loads', () => {
    use.mockReturnValue({
      rotateThemes: vi.fn(),
      size: 10,
      toggleConfig: vi.fn(),
    })

    const { getByText, queryByText } = renderPerspective()

    expect(getByText('Filter and plot')).toBeTruthy()
    expect(queryByText('Could not render tabular data')).toBeNull()
  })
})
