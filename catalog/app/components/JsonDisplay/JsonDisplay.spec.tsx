import * as React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { render } from '@testing-library/react'
import { ThemeOptions, ThemeProvider, createMuiTheme } from '@material-ui/core/styles'

import { bucketFile } from 'constants/routes'
import * as NamedRoutes from 'utils/NamedRoutes'

import JsonDisplay from './JsonDisplay'

vi.mock('constants/config', () => ({ default: {} }))

// the styles use the app theme's `typography.monospace` extension
const theme = createMuiTheme({
  typography: {
    monospace: {
      fontFamily: 'monospace',
    },
  } as ThemeOptions['typography'],
})

// use-resize-observer requires the ResizeObserver global, which jsdom lacks
vi.stubGlobal(
  'ResizeObserver',
  class {
    observe() {}

    unobserve() {}

    disconnect() {}
  },
)

const value = { ptr: 's3://bucket/path/to/key' }

function renderValue(props = {}) {
  return render(
    <ThemeProvider theme={theme}>
      <MemoryRouter>
        <NamedRoutes.Provider routes={{ bucketFile }}>
          <JsonDisplay value={value} defaultExpanded {...props} />
        </NamedRoutes.Provider>
      </MemoryRouter>
    </ThemeProvider>,
  )
}

describe('components/JsonDisplay', () => {
  it('renders s3:// strings as links to the bucket file view by default', async () => {
    const { findByRole } = renderValue()
    const link = await findByRole('link')
    expect(link.getAttribute('href')).toBe('/b/bucket/tree/path/to/key')
    expect(link.textContent).toBe('s3://bucket/path/to/key')
  })

  it('renders s3:// strings as plain text with noS3Links', async () => {
    const { findByText, queryByRole } = renderValue({ noS3Links: true })
    await findByText(/s3:\/\/bucket\/path\/to\/key/)
    expect(queryByRole('link')).toBeNull()
  })
})
