import * as React from 'react'
import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, it, expect, vi } from 'vitest'
import { ThemeOptions, ThemeProvider, createMuiTheme } from '@material-ui/core/styles'

import JsonEditor from './JsonEditor'

const theme = createMuiTheme({
  typography: { monospace: { fontFamily: 'monospace' } } as ThemeOptions['typography'],
})

function editFirstValue(disabled: boolean) {
  const onChange = vi.fn()
  const { getAllByRole, getByDisplayValue } = render(
    <ThemeProvider theme={theme}>
      <JsonEditor
        disabled={disabled}
        errors={[]}
        onChange={onChange}
        value={{ a: 'x' }}
      />
    </ThemeProvider>,
  )
  // Cells are [key, value] per row; the value cell of row `a` is the second.
  fireEvent.doubleClick(getAllByRole('textbox')[1])
  const input = getByDisplayValue('"x"')
  fireEvent.change(input, { target: { value: '"y"' } })
  fireEvent.keyDown(input, { key: 'Enter' })
  return onChange
}

describe('components/JsonEditor', () => {
  afterEach(cleanup)

  it('commits keyboard edits when enabled', () => {
    expect(editFirstValue(false)).toHaveBeenCalledWith({ a: 'y' })
  })

  it('ignores keyboard edits when disabled', () => {
    expect(editFirstValue(true)).not.toHaveBeenCalled()
  })
})
