import * as React from 'react'
import renderer from 'react-test-renderer'

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
      <b dangerouslySetInnerHTML={{ __html: rendered }}>Markdown</b>
    ),
)

jest.mock(
  '@material-ui/lab',
  jest.fn(() => ({
    Alert: ({ children }: { children: string }) => <div>Error: {children}</div>,
  })),
)

const handle = {
  bucket: 'foo',
  key: 'bar',
}

describe('app/components/Preview/quick/Render.spec.tsx', () => {
  it('it shows the error for Init state, because it is intended to run with already resolved value', () => {
    useMarkdownRenderer.mockReturnValue(AsyncResult.Init())
    const tree = renderer.create(<Render {...{ handle, value: 'any' }} />).toJSON()
    expect(tree).toMatchSnapshot()
  })

  it('it shows the error for Pending state, because it is intended to run with already resolved value', () => {
    useMarkdownRenderer.mockReturnValue(AsyncResult.Pending())
    const tree = renderer.create(<Render {...{ handle, value: 'any' }} />).toJSON()
    expect(tree).toMatchSnapshot()
  })

  it('returns error on Err', () => {
    useMarkdownRenderer.mockReturnValue(AsyncResult.Err(new Error('some error')))
    const tree = renderer.create(<Render {...{ handle, value: 'any' }} />).toJSON()
    expect(tree).toMatchSnapshot()
  })

  it('returns markdown on data', () => {
    useMarkdownRenderer.mockReturnValue(AsyncResult.Ok('<h1>It works</h1>'))
    const tree = renderer.create(<Render {...{ handle, value: 'any' }} />).toJSON()
    expect(tree).toMatchSnapshot()
  })
})
