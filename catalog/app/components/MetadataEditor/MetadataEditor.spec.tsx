import * as React from 'react'
import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import MetadataEditor from './MetadataEditor'

// jsoneditor needs a real DOM editor; the stub hands back the props it would receive
const received: { onChangeText?: (text: string) => void } = {}
vi.mock('jsoneditor-react', () => ({
  JsonEditor: (props: { onChangeText?: (text: string) => void }) => {
    received.onChangeText = props.onChangeText
    return null
  },
}))
vi.mock('brace', () => ({ default: {} }))
vi.mock('brace/mode/json', () => ({}))
vi.mock('brace/theme/eclipse', () => ({}))
vi.mock('jsoneditor-react/es/editor.min.css', () => ({}))
vi.mock('components/JsonEditor', () => ({ default: () => null }))

describe('components/MetadataEditor', () => {
  it('reports whether the raw JSON text parses, so Save can wait for a fix', () => {
    const onTextValid = vi.fn()
    render(
      <MetadataEditor
        isRaw
        multiColumned={false}
        onChange={() => {}}
        onTextValid={onTextValid}
        value={{ a: 1 }}
      />,
    )
    received.onChangeText?.('{"a": 1')
    expect(onTextValid).toHaveBeenLastCalledWith(false)
    received.onChangeText?.('{"a": 2}')
    expect(onTextValid).toHaveBeenLastCalledWith(true)
  })
})
