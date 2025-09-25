import * as React from 'react'
import { render } from '@testing-library/react'

import AsyncResult from 'utils/AsyncResult'

import Render from './Render'

jest.mock(
  'constants/config',
  jest.fn(() => {}),
)

const useMarkdownRenderer = jest.fn()
jest.mock('components/Preview/loaders/Markdown', () => ({
  ...jest.requireActual('components/Preview/loaders/Markdown'),
  useMarkdownRenderer: jest.fn(() => useMarkdownRenderer()),
}))

jest.mock(
  'components/Preview/renderers/Markdown',
  () =>
    ({ rendered }: { rendered: string }) => (
      // eslint-disable-next-line react/no-danger
      <section dangerouslySetInnerHTML={{ __html: rendered }} />
    ),
)

jest.mock(
  '@material-ui/lab',
  jest.fn(() => ({
    Alert: ({ children }: { children: string }) => <p>Error: {children}</p>,
  })),
)

const handle = {
  bucket: 'foo',
  key: 'bar',
}

describe('app/components/Preview/quick/Render.spec.tsx', () => {
  it('it shows the error for Init state, because it is intended to run with already resolved value', () => {
    useMarkdownRenderer.mockReturnValue(AsyncResult.Init())
    const { container } = render(<Render {...{ handle, value: 'any' }} />)
    expect(container.firstChild).toMatchSnapshot()
  })

  it('it shows the error for Pending state, because it is intended to run with already resolved value', () => {
    useMarkdownRenderer.mockReturnValue(AsyncResult.Pending())
    const { container } = render(<Render {...{ handle, value: 'any' }} />)
    expect(container.firstChild).toMatchSnapshot()
  })

  it('returns error on Err', () => {
    useMarkdownRenderer.mockReturnValue(AsyncResult.Err(new Error('some error')))
    const { container } = render(<Render {...{ handle, value: 'any' }} />)
    expect(container.firstChild).toMatchSnapshot()
  })

  it('returns markdown on data', () => {
    useMarkdownRenderer.mockReturnValue(AsyncResult.Ok('<h1>It works</h1>'))
    const { container } = render(<Render {...{ handle, value: 'any' }} />)
    expect(container.firstChild).toMatchSnapshot()
  })
})
