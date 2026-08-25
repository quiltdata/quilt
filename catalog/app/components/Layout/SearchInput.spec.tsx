import * as React from 'react'
import { render, cleanup } from '@testing-library/react'
import { describe, it, expect, afterEach } from 'vitest'

import { SearchInputProvider, useSearchInput, useSearchInputRef } from './SearchInput'

// Stands in for ContentBar: the one query field on the page, which registers
// itself so the page below can reach it.
function Bar() {
  const inputRef = useSearchInputRef()
  return <input ref={inputRef} defaultValue="genomes" />
}

// Stands in for the search screen's empty-results refine affordances.
function Page({ onReady }: { onReady: (h: ReturnType<typeof useSearchInput>) => void }) {
  const searchInput = useSearchInput()
  React.useEffect(() => onReady(searchInput), [onReady, searchInput])
  return null
}

const renderBoth = () => {
  let handle: ReturnType<typeof useSearchInput> | undefined
  const utils = render(
    <SearchInputProvider>
      <Bar />
      <Page onReady={(h) => (handle = h)} />
    </SearchInputProvider>,
  )
  return { ...utils, getHandle: () => handle! }
}

describe('components/Layout/SearchInput', () => {
  afterEach(cleanup)

  it('focuses the registered field', () => {
    const { container, getHandle } = renderBoth()
    const input = container.querySelector('input')!
    expect(document.activeElement).not.toBe(input)
    getHandle().focus()
    expect(document.activeElement).toBe(input)
  })

  it('selects the text in the registered field', () => {
    const { container, getHandle } = renderBoth()
    const input = container.querySelector('input')! as HTMLInputElement
    getHandle().select()
    expect(input.selectionStart).toBe(0)
    expect(input.selectionEnd).toBe('genomes'.length)
  })

  it('keeps a stable handle across re-renders', () => {
    // Consumers put this in `useCallback` deps, so a new identity per render
    // would rebuild their callbacks on every render.
    const handles: ReturnType<typeof useSearchInput>[] = []
    const { rerender } = render(
      <SearchInputProvider>
        <Bar />
        <Page onReady={(h) => handles.push(h)} />
      </SearchInputProvider>,
    )
    rerender(
      <SearchInputProvider>
        <Bar />
        <Page onReady={(h) => handles.push(h)} />
      </SearchInputProvider>,
    )
    expect(handles.length).toBeGreaterThan(1)
    expect(new Set(handles).size).toBe(1)
  })

  it('no-ops without a provider rather than throwing', () => {
    // A page under a `bare` layout has no header search bar to reach.
    let handle: ReturnType<typeof useSearchInput> | undefined
    render(<Page onReady={(h) => (handle = h)} />)
    expect(() => {
      handle!.focus()
      handle!.select()
    }).not.toThrow()
  })

  it('no-ops before the field mounts', () => {
    let handle: ReturnType<typeof useSearchInput> | undefined
    render(
      <SearchInputProvider>
        <Page onReady={(h) => (handle = h)} />
      </SearchInputProvider>,
    )
    expect(() => handle!.focus()).not.toThrow()
  })
})
