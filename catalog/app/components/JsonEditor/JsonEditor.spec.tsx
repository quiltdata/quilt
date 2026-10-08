import * as React from 'react'
import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, it, expect, vi } from 'vitest'
import { ThemeOptions, ThemeProvider, createMuiTheme } from '@material-ui/core/styles'

import JsonEditor from './JsonEditor'

const theme = createMuiTheme({
  typography: { monospace: { fontFamily: 'monospace' } } as ThemeOptions['typography'],
})

const editor = (disabled: boolean, onChange = vi.fn()) => (
  <ThemeProvider theme={theme}>
    <JsonEditor disabled={disabled} errors={[]} onChange={onChange} value={{ a: 'x' }} />
  </ThemeProvider>
)

// Cells are [key, value] per row; the value cell of row `a` is the second.
const valueCell = (view: ReturnType<typeof render>) => view.getAllByRole('textbox')[1]

describe('components/JsonEditor', () => {
  afterEach(cleanup)

  it('commits keyboard edits when enabled', () => {
    const onChange = vi.fn()
    const view = render(editor(false, onChange))
    fireEvent.doubleClick(valueCell(view))
    const input = view.getByDisplayValue('"x"')
    fireEvent.change(input, { target: { value: '"y"' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onChange).toHaveBeenCalledWith({ a: 'y' })
  })

  it('opens no input when disabled', () => {
    const view = render(editor(true))
    fireEvent.doubleClick(valueCell(view))
    expect(view.queryByDisplayValue('"x"')).toBeNull()
  })

  it('shows the document value in a cell that was editing when disabled', () => {
    const onChange = vi.fn()
    const view = render(editor(false, onChange))
    fireEvent.doubleClick(valueCell(view))
    const input = view.getByDisplayValue('"x"')
    view.rerender(editor(true, onChange))
    fireEvent.change(input, { target: { value: '"y"' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onChange).not.toHaveBeenCalled()
    expect(view.queryByDisplayValue('"y"')).toBeNull()
    expect(valueCell(view).textContent).toContain('x')
    expect(valueCell(view).textContent).not.toContain('y')
  })
})
