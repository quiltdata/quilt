import * as React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { ThemeOptions, ThemeProvider, createMuiTheme } from '@material-ui/core/styles'
import { describe, expect, it, vi } from 'vitest'

import JsonEditor from './JsonEditor'
import { typeLabel } from './Row'

const schema = {
  type: 'object',
  required: ['project'],
  properties: {
    project: { type: 'string', description: 'Program code' },
    assay: { enum: ['RNA-seq', 'ATAC-seq'] },
    collected: { type: 'string', format: 'date' },
  },
}

// the styles use the app theme's `typography.monospace` extension
const theme = createMuiTheme({
  typography: { monospace: { fontFamily: 'monospace' } } as ThemeOptions['typography'],
})

// holds the value like the dialog does, so a commit re-renders (and re-keys) the rows
function Editor({
  mode,
  onChange,
  renderEmptyValue,
}: {
  mode?: 'default' | 'property'
  onChange: (v: unknown) => void
  renderEmptyValue?: (address: (string | number)[]) => React.ReactNode
}) {
  const [value, setValue] = React.useState<unknown>({
    project: 'ONC-104',
    lab_notebook: 'ELN-2291',
  })
  return (
    <JsonEditor
      errors={[]}
      mode={mode}
      onChange={(v: unknown) => {
        setValue(v)
        onChange(v)
      }}
      renderEmptyValue={renderEmptyValue}
      schema={schema}
      value={value}
    />
  )
}

const renderEditor = (
  mode?: 'default' | 'property',
  onChange: (v: unknown) => void = () => {},
) =>
  render(
    <ThemeProvider theme={theme}>
      <Editor mode={mode} onChange={onChange} />
    </ThemeProvider>,
  )

describe('components/JsonEditor', () => {
  describe('property mode', () => {
    it('adds Type and About columns with the schema description and a required mark', () => {
      renderEditor('property')
      expect(screen.getByText('Type')).toBeTruthy()
      expect(screen.getByText('About')).toBeTruthy()
      expect(screen.getByText('Program code')).toBeTruthy()
      expect(screen.getByLabelText('required')).toBeTruthy()
      expect(screen.getByText('choice')).toBeTruthy()
      expect(screen.getByText('date')).toBeTruthy()
      expect(screen.getByText('Not in workflow')).toBeTruthy()
    })
  })

  describe('keyboard', () => {
    // the project value cell: rows follow the schema order
    const projectCell = () =>
      screen.getAllByRole('textbox').find((el) => el.textContent?.includes('ONC-104'))!

    it('Enter edits and Enter commits, keeping focus on the cell', async () => {
      const onChange = vi.fn()
      renderEditor('property', onChange)
      const cell = projectCell()
      cell.focus()
      fireEvent.keyPress(cell, { key: 'Enter', code: 'Enter', charCode: 13 })
      const input = cell.querySelector('input')!
      fireEvent.change(input, { target: { value: 'ONC-200' } })
      fireEvent.keyDown(input, { key: 'Enter' })
      expect(onChange).toHaveBeenLastCalledWith(
        expect.objectContaining({ project: 'ONC-200' }),
      )
      await new Promise((r) => setTimeout(r))
      // the row remounted on commit: the focused cell is the new one at the same address
      expect(document.activeElement?.textContent).toContain('ONC-200')
      expect(document.activeElement?.getAttribute('role')).toBe('textbox')
    })

    it('Esc drops the edit and keeps the value', async () => {
      const onChange = vi.fn()
      renderEditor('property', onChange)
      const cell = projectCell()
      cell.focus()
      fireEvent.keyPress(cell, { key: 'Enter', code: 'Enter', charCode: 13 })
      const input = cell.querySelector('input')!
      fireEvent.change(input, { target: { value: 'typo' } })
      fireEvent.keyDown(input, { key: 'Escape' })
      fireEvent.blur(input)
      expect(onChange).not.toHaveBeenCalled()
      expect(projectCell().textContent).toContain('ONC-104')
    })
  })

  describe('empty value slot', () => {
    const slot = (address: (string | number)[]) =>
      address.join('/') === 'assay' ? <i>RNA-seq?</i> : null

    it('shows the slot in an empty value cell in property mode only', () => {
      render(
        <ThemeProvider theme={theme}>
          <Editor mode="property" onChange={() => {}} renderEmptyValue={slot} />
        </ThemeProvider>,
      )
      expect(screen.getByText('RNA-seq?')).toBeTruthy()
    })

    it('is ignored by the default grid', () => {
      render(
        <ThemeProvider theme={theme}>
          <Editor onChange={() => {}} renderEmptyValue={slot} />
        </ThemeProvider>,
      )
      expect(screen.queryByText('RNA-seq?')).toBeNull()
    })
  })

  it('leaves the default grid as it was: no header and no extra columns', () => {
    renderEditor()
    expect(screen.queryByText('Type')).toBeNull()
    expect(screen.queryByText('Program code')).toBeNull()
    expect(screen.queryByLabelText('required')).toBeNull()
  })

  describe('typeLabel', () => {
    it.each([
      [{ type: 'integer' }, 'integer'],
      [{ type: ['string', 'null'] }, 'string'],
      [{ type: ['string', 'number'] }, 'mixed'],
      [{ type: 'array' }, 'list'],
      [{}, ''],
    ])('%j is %s', (s, label) => {
      expect(typeLabel(s)).toBe(label)
    })
  })
})
