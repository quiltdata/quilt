import * as React from 'react'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import MetaForm from './MetaForm'

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
})
