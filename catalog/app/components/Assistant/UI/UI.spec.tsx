import * as React from 'react'
import { MemoryRouter } from 'react-router-dom'
import { render, cleanup } from '@testing-library/react'
import { describe, it, expect, vi, afterEach } from 'vitest'

import { WithAssistantUI } from './UI'

const useAssistantAPI = vi.fn()

vi.mock('../Model', () => ({
  useAssistantAPI: () => useAssistantAPI(),
}))

// The Sidebar's Drawer is irrelevant to these tests; render it as a no-op
// to avoid pulling in the whole Chat subtree.
vi.mock('./Chat', () => ({
  default: () => null,
}))

function makeAPI() {
  return {
    visible: false,
    show: vi.fn(),
    hide: vi.fn(),
    state: {},
    dispatch: vi.fn(),
    devTools: {},
    connectors: {},
  }
}

function renderAt(pathname: string) {
  return render(
    <MemoryRouter initialEntries={[pathname]}>
      <WithAssistantUI />
    </MemoryRouter>,
  )
}

describe('components/Assistant/UI', () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('hides the Fab on the bucket overview route', () => {
    useAssistantAPI.mockReturnValue(makeAPI())
    const { queryByRole } = renderAt('/b/some-bucket')
    expect(queryByRole('button')).toBeFalsy()
  })

  it('shows the Fab on a non-overview bucket route', () => {
    useAssistantAPI.mockReturnValue(makeAPI())
    const { queryByRole } = renderAt('/b/some-bucket/tree/')
    expect(queryByRole('button')).toBeTruthy()
  })
})
