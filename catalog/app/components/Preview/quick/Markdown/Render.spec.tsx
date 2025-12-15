import * as React from 'react'
import { render, cleanup } from '@testing-library/react'
import { describe, it, expect, vi, afterEach } from 'vitest'

import AsyncResult from 'utils/AsyncResult'

import Render from './Render'

vi.mock('constants/config', () => ({ default: {} }))

const useMarkdownRenderer = vi.fn()
vi.mock('components/Preview/loaders/Markdown', async () => ({
  ...(await vi.importActual('components/Preview/loaders/Markdown')),
  useMarkdownRenderer: () => useMarkdownRenderer(),
}))

vi.mock('components/Preview/renderers/Markdown', () => ({
  default: ({ rendered }: { rendered: string }) => (
    // eslint-disable-next-line react/no-danger
    <section dangerouslySetInnerHTML={{ __html: rendered }} />
  ),
}))

vi.mock('@material-ui/lab', () => ({
  Alert: ({ children }: { children: string }) => <p>Error: {children}</p>,
}))

const handle = {
  bucket: 'foo',
  key: 'bar',
}

describe('app/components/Preview/quick/Render.spec.tsx', () => {
  afterEach(cleanup)

  it('it shows the error for Init state, because it is intended to run with already resolved value', () => {
    useMarkdownRenderer.mockReturnValue(AsyncResult.Init())
    const { getByText } = render(<Render {...{ handle, value: 'any' }} />)
    expect(getByText('Error: Unexpected state')).toBeTruthy()
  })

  it('it shows the error for Pending state, because it is intended to run with already resolved value', () => {
    useMarkdownRenderer.mockReturnValue(AsyncResult.Pending())
    const { getByText } = render(<Render {...{ handle, value: 'any' }} />)
    expect(getByText('Error: Unexpected state')).toBeTruthy()
  })

  it('returns error on Err', () => {
    useMarkdownRenderer.mockReturnValue(AsyncResult.Err(new Error('some error')))
    const { getByText } = render(<Render {...{ handle, value: 'any' }} />)
    expect(getByText('Error: some error')).toBeTruthy()
  })

  it('returns markdown on data', () => {
    useMarkdownRenderer.mockReturnValue(AsyncResult.Ok('<h1>It works</h1>'))
    const { getByText } = render(<Render {...{ handle, value: 'any' }} />)
    expect(getByText('It works')).toBeTruthy()
  })
})
