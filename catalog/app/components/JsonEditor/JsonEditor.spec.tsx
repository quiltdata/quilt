import * as React from 'react'
import { render, screen } from '@testing-library/react'
import { ThemeOptions, ThemeProvider, createMuiTheme } from '@material-ui/core/styles'
import { describe, expect, it } from 'vitest'

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

const renderEditor = (mode?: 'default' | 'property') =>
  render(
    <ThemeProvider theme={theme}>
      <JsonEditor
        errors={[]}
        mode={mode}
        onChange={() => {}}
        schema={schema}
        value={{ project: 'ONC-104', lab_notebook: 'ELN-2291' }}
      />
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
