import * as React from 'react'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import MetaForm, { FreeFields } from './MetaForm'

vi.mock('constants/config', () => ({ default: {} }))

const schema = {
  type: 'object',
  required: ['level'],
  properties: {
    level: { title: 'Level', enum: [1, 2, true] },
    note: { title: 'Note', type: 'string' },
  },
}

describe('containers/Bucket/PackageDialog/Inputs/MetaForm', () => {
  afterEach(cleanup)

  it('stores the enum value itself, not its label', () => {
    const onChange = vi.fn()
    render(
      <MetaForm
        disabled={false}
        errors={[]}
        onChange={onChange}
        onShowTable={() => {}}
        schema={schema}
        value={{}}
      />,
    )
    fireEvent.mouseDown(screen.getByRole('button', { name: /Level/ }))
    fireEvent.click(within(screen.getByRole('listbox')).getByText('2'))
    expect(onChange).toHaveBeenLastCalledWith({ level: 2 })
  })

  it('fills a field only when its suggestion is clicked', () => {
    const onChange = vi.fn()
    render(
      <MetaForm
        disabled={false}
        errors={[]}
        onChange={onChange}
        onShowTable={() => {}}
        schema={schema}
        suggestions={{ note: { value: 'from similar packages' } }}
        value={{}}
      />,
    )
    expect(onChange).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: /Use suggested Note/ }))
    expect(onChange).toHaveBeenLastCalledWith({ note: 'from similar packages' })
  })

  describe('FreeFields', () => {
    const renderFree = (value: any, onChange = vi.fn()) => {
      render(
        <FreeFields
          description="d"
          disabled={false}
          onChange={onChange}
          title="Fields"
          value={value}
        />,
      )
      return onChange
    }

    it('adds a field as a string', () => {
      const onChange = renderFree({ a: 1 })
      fireEvent.click(screen.getByRole('button', { name: /Add field/ }))
      const [, , name, val] = screen.getAllByRole('textbox')
      fireEvent.change(name, { target: { value: 'instrument' } })
      fireEvent.change(val, { target: { value: '42' } })
      fireEvent.blur(val)
      expect(onChange).toHaveBeenLastCalledWith({ a: 1, instrument: '42' })
    })

    it('keeps a non-string value typed and renames in place', () => {
      const onChange = renderFree({ a: 1, b: 'x' })
      fireEvent.change(screen.getByRole('textbox', { name: 'Value of a' }), {
        target: { value: '7' },
      })
      expect(onChange).toHaveBeenLastCalledWith({ a: 7, b: 'x' })
      const name = screen.getByRole('textbox', { name: 'Name of field a' })
      fireEvent.change(name, { target: { value: 'count' } })
      fireEvent.blur(name)
      expect(onChange).toHaveBeenLastCalledWith({ count: 1, b: 'x' })
    })
  })
})
