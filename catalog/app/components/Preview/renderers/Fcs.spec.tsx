import * as React from 'react'
import { render, screen, cleanup } from '@testing-library/react'
import { ThemeProvider, createMuiTheme } from '@material-ui/core/styles'
import { afterEach, describe, expect, it, vi } from 'vitest'

import renderFcs from './Fcs'

vi.mock('components/JsonDisplay', () => ({
  default: ({ value }: { value: unknown }) => (
    <div data-testid="json">{JSON.stringify(value)}</div>
  ),
}))

vi.mock('./Vega', () => ({
  default: ({ spec, className }: { spec: unknown; className?: string }) => (
    <div className={className} data-testid="vega">
      {JSON.stringify(spec)}
    </div>
  ),
}))

const theme = createMuiTheme()

function renderWithTheme(component: React.ReactElement) {
  return render(<ThemeProvider theme={theme}>{component}</ThemeProvider>)
}

describe('components/Preview/renderers/Fcs', () => {
  afterEach(cleanup)

  it('renders metadata warnings table preview and vega chart', () => {
    const spec = { mark: 'point', data: { values: [{ x: 1, y: 2 }] } }
    const { container } = renderWithTheme(
      renderFcs({
        preview: '<table class="dataframe"><tbody><tr><td>42</td></tr></tbody></table>',
        metadata: { sample: 'value' },
        note: 'Downsampled preview',
        vegaLite: spec,
        warnings: 'bad rows',
      }) as React.ReactElement,
    )

    expect(screen.getByText('Parsing errors')).toBeTruthy()
    expect(screen.getByTestId('json').textContent).toContain('"sample":"value"')
    expect(screen.getByTestId('vega').textContent).toBe(JSON.stringify(spec))
    expect(container.querySelector('table.dataframe')).toBeTruthy()
    expect(container.querySelector('[title="Downsampled preview"]')).toBeTruthy()
  })

  it('omits the vega chart when no spec is present', () => {
    renderWithTheme(
      renderFcs({
        preview: '<div>preview</div>',
        metadata: { sample: 'value' },
      }) as React.ReactElement,
    )

    expect(screen.queryByTestId('vega')).toBeFalsy()
  })
})
