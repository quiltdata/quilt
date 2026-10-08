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
  const onUse = vi.fn()
  afterEach(cleanup)

  it('stores the enum value itself, not its label', () => {
    const onChange = vi.fn()
    render(
      <MetaForm
        disabled={false}
        errors={[]}
        onChange={onChange}
        onShowTable={() => {}}
        onUseSuggestion={onUse}
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
        onUseSuggestion={onUse}
        schema={schema}
        suggestions={{ note: { value: 'from similar packages' } }}
        value={{}}
      />,
    )
    expect(onChange).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: /Use suggested Note/ }))
    expect(onUse).toHaveBeenLastCalledWith('note', 'from similar packages')
    expect(onChange).not.toHaveBeenCalled()
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

  describe('FreeFields drafts', () => {
    it('keeps a JSON value typed while it is half-edited', () => {
      const onChange = vi.fn()
      render(
        <FreeFields
          description="d"
          disabled={false}
          onChange={onChange}
          title="t"
          value={{ a: { x: 1 } }}
        />,
      )
      const input = screen.getByRole('textbox', { name: 'Value of a' })
      fireEvent.change(input, { target: { value: '{"x": 2' } })
      expect(onChange).not.toHaveBeenCalled()
      fireEvent.change(input, { target: { value: '{"x": 2}' } })
      expect(onChange).toHaveBeenLastCalledWith({ a: { x: 2 } })
    })

    it('refuses a rename to an existing name and says so', () => {
      const onChange = vi.fn()
      render(
        <FreeFields
          description="d"
          disabled={false}
          onChange={onChange}
          title="t"
          value={{ a: 1, b: 2 }}
        />,
      )
      const name = screen.getByRole('textbox', { name: 'Name of field a' })
      fireEvent.change(name, { target: { value: 'b' } })
      fireEvent.blur(name)
      expect(onChange).not.toHaveBeenCalled()
      expect(screen.getByText('Already used')).toBeTruthy()
    })
  })

  it('keeps a half-typed number as text and reports it pending', () => {
    const onChange = vi.fn()
    const setPending = vi.fn()
    const num = {
      type: 'object',
      properties: { ratio: { title: 'Ratio', type: 'number' } },
    }
    render(
      <MetaForm
        disabled={false}
        errors={[]}
        onChange={onChange}
        onShowTable={() => {}}
        onUseSuggestion={onUse}
        schema={num}
        setPending={setPending}
        value={{}}
      />,
    )
    const input = screen.getByRole('textbox', { name: /Ratio/ })
    fireEvent.change(input, { target: { value: '-' } })
    expect((input as HTMLInputElement).value).toBe('-')
    expect(setPending).toHaveBeenLastCalledWith('ratio', true)
    // "1." is a finished number; its text stays as typed while the value is 1
    fireEvent.change(input, { target: { value: '1.' } })
    expect((input as HTMLInputElement).value).toBe('1.')
    expect(onChange).toHaveBeenLastCalledWith({ ratio: 1 })
    expect(setPending).toHaveBeenLastCalledWith('ratio', false)
    fireEvent.change(input, { target: { value: '1.5' } })
    expect(onChange).toHaveBeenLastCalledWith({ ratio: 1.5 })
    expect(setPending).toHaveBeenLastCalledWith('ratio', false)
    fireEvent.change(input, { target: { value: '1e+5' } })
    expect(onChange).toHaveBeenLastCalledWith({ ratio: 100000 })
    expect(setPending).toHaveBeenLastCalledWith('ratio', false)
  })

  describe('round 4 drafts', () => {
    it('holds the submit while a rename is refused', () => {
      const setPending = vi.fn()
      render(
        <FreeFields
          description="d"
          disabled={false}
          onChange={vi.fn()}
          setPending={setPending}
          title="t"
          value={{ a: 1, b: 2 }}
        />,
      )
      const name = screen.getByRole('textbox', { name: 'Name of field a' })
      fireEvent.change(name, { target: { value: 'b' } })
      fireEvent.blur(name)
      expect(setPending).toHaveBeenLastCalledWith('a', true)
    })

    it('discards a new field without saving it', () => {
      const onChange = vi.fn()
      render(
        <FreeFields
          description="d"
          disabled={false}
          onChange={onChange}
          title="t"
          value={{}}
        />,
      )
      fireEvent.click(screen.getByRole('button', { name: /Add field/ }))
      const [name, val] = screen.getAllByRole('textbox')
      fireEvent.change(name, { target: { value: 'lab' } })
      fireEvent.change(val, { target: { value: 'x' } })
      const discard = screen.getByRole('button', { name: 'Discard new field' })
      fireEvent.mouseDown(discard)
      fireEvent.click(discard)
      expect(onChange).not.toHaveBeenCalled()
    })

    it('clears a half-typed number and its pending flag together', () => {
      const onChange = vi.fn()
      const setPending = vi.fn()
      const num = {
        type: 'object',
        properties: { ratio: { title: 'Ratio', type: 'number' } },
      }
      render(
        <MetaForm
          disabled={false}
          errors={[]}
          onChange={onChange}
          onShowTable={() => {}}
          onUseSuggestion={onUse}
          schema={num}
          setPending={setPending}
          value={{}}
        />,
      )
      const input = screen.getByRole('textbox', { name: /Ratio/ }) as HTMLInputElement
      fireEvent.change(input, { target: { value: '-' } })
      expect(setPending).toHaveBeenLastCalledWith('ratio', true)
      fireEvent.change(input, { target: { value: '' } })
      expect(setPending).toHaveBeenLastCalledWith('ratio', false)
      expect(input.value).toBe('')
    })
  })

  it('shows a boolean as Yes/No and leaves it unset until chosen', () => {
    const onChange = vi.fn()
    const bool = {
      type: 'object',
      required: ['approved'],
      properties: { approved: { title: 'Approved', type: 'boolean' } },
    }
    render(
      <MetaForm
        disabled={false}
        errors={[]}
        onChange={onChange}
        onShowTable={() => {}}
        onUseSuggestion={onUse}
        schema={bool}
        value={{}}
      />,
    )
    const yes = screen.getByRole('button', { name: 'Yes' })
    const no = screen.getByRole('button', { name: 'No' })
    expect(yes.getAttribute('aria-pressed')).toBe('false')
    expect(no.getAttribute('aria-pressed')).toBe('false')
    fireEvent.click(no)
    expect(onChange).toHaveBeenLastCalledWith({ approved: false })
  })

  describe('round 8', () => {
    it('routes a composed field to the table editor instead of a text input', () => {
      const composed = {
        type: 'object',
        properties: {
          details: { title: 'Details', anyOf: [{ type: 'object' }, { type: 'string' }] },
        },
      }
      render(
        <MetaForm
          disabled={false}
          errors={[]}
          onChange={vi.fn()}
          onShowTable={() => {}}
          onUseSuggestion={onUse}
          schema={composed}
          value={{ details: { count: 1 } }}
        />,
      )
      expect(screen.getByRole('button', { name: /Edit in table view/ })).toBeTruthy()
      expect(screen.queryByRole('textbox', { name: /Details/ })).toBeNull()
    })

    it('shows a stored null as null, not as an empty value', () => {
      render(
        <FreeFields
          description="d"
          disabled={false}
          onChange={vi.fn()}
          title="t"
          value={{ a: null }}
        />,
      )
      const input = screen.getByRole('textbox', {
        name: 'Value of a',
      }) as HTMLInputElement
      expect(input.value).toBe('null')
    })
  })

  it('holds an integer too large to store exactly and says why', () => {
    const onChange = vi.fn()
    const setPending = vi.fn()
    const int = { type: 'object', properties: { id: { title: 'ID', type: 'integer' } } }
    render(
      <MetaForm
        disabled={false}
        errors={[]}
        onChange={onChange}
        onShowTable={() => {}}
        onUseSuggestion={onUse}
        schema={int}
        setPending={setPending}
        value={{}}
      />,
    )
    fireEvent.change(screen.getByRole('textbox', { name: /ID/ }), {
      target: { value: '9007199254740993' },
    })
    expect(onChange).not.toHaveBeenCalled()
    expect(setPending).toHaveBeenLastCalledWith('id', true)
    expect(screen.getByText(/Too large to store exactly/)).toBeTruthy()
  })
})
