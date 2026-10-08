import * as React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { render } from '@testing-library/react'

import TextEditor from './TextEditor'

vi.stubGlobal(
  'ResizeObserver',
  class {
    observe() {}
    unobserve() {}
  },
)

const type = { brace: 'text' } as any

describe('components/FileEditor/TextEditor', () => {
  it('takes no input once disabled, and keeps the value', () => {
    const onChange = vi.fn()
    const props = { className: '', error: null, onChange, type, initialValue: 'draft' }
    const { container, rerender } = render(<TextEditor {...props} />)
    const editor = (container.querySelector('.ace_editor') as any).env.editor
    expect(editor.getReadOnly()).toBe(false)

    rerender(<TextEditor {...props} disabled />)
    expect(editor.getReadOnly()).toBe(true)
    editor.onTextInput(' typed')
    editor.onPaste(' pasted')
    expect(editor.getValue()).toBe('draft')

    rerender(<TextEditor {...props} disabled={false} />)
    expect(editor.getReadOnly()).toBe(false)
  })
})
