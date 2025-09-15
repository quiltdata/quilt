import * as React from 'react'
import { render } from '@testing-library/react'
import { renderHook } from '@testing-library/react-hooks'

import AsyncResult from 'utils/AsyncResult'

import { useState } from './State'
import { Editor } from './FileEditor'

jest.mock('utils/AWS', () => ({ S3: { use: () => {} } }))

jest.mock('./Skeleton', () => () => <div id="Skeleton" />)

jest.mock('utils/NamedRoutes', () => ({
  ...jest.requireActual('utils/NamedRoutes'),
  use: jest.fn(() => ({ urls: {} })),
}))

jest.mock(
  'react-router-dom',
  jest.fn(() => ({
    ...jest.requireActual('react-router-dom'),
    useParams: jest.fn(() => ({ bucket: 'b', key: 'k' })),
    useLocation: jest.fn(() => ({ search: '?edit=true' })),
  })),
)

jest.mock(
  'components/Preview/Display',
  jest.fn(() => () => <div id="error" />),
)

const getObjectData = jest.fn((cases: any) =>
  AsyncResult.case(cases, AsyncResult.Ok({ Body: 'body' })),
)

jest.mock(
  'components/Preview/loaders/utils',
  jest.fn(() => ({
    ...jest.requireActual('components/Preview/loaders/utils'),
    useObjectGetter: () => ({
      case: getObjectData,
    }),
  })),
)

jest.mock(
  './TextEditor',
  jest.fn(() => ({ initialValue }: { initialValue: string }) => (
    <div id="Text Editor">
      <span id="initialValue">{initialValue}</span>
    </div>
  )),
)

jest.mock(
  'constants/config',
  jest.fn(() => ({})),
)

const loadMode = jest.fn(() => 'fulfilled')

jest.mock(
  './loader',
  jest.fn(() => ({
    loadMode: jest.fn(() => loadMode()),
    detect: () => 'text',
    useWriteData: () => {},
  })),
)

describe('components/FileEditor/FileEditor', () => {
  describe('Editor', () => {
    const handle = { bucket: 'b', key: 'k' }
    const hookData = renderHook(() => useState(handle))
    const state = hookData.result.current
    it('shows skeleton when loadMode is not resolved yet', () => {
      loadMode.mockImplementationOnce(() => {
        throw Promise.resolve(null)
      })
      const { container } = render(
        <Editor
          {...state}
          className="root"
          editing={{ brace: 'json' }}
          handle={handle}
        />,
      )
      expect(container.firstChild).toMatchSnapshot()
    })

    it('shows TextEditor', () => {
      const { container } = render(
        <Editor
          {...state}
          className="root"
          editing={{ brace: 'json' }}
          handle={handle}
        />,
      )
      expect(container.firstChild).toMatchSnapshot()
    })

    it('shows an empty TextEditor', () => {
      const { container } = render(
        <Editor
          {...state}
          empty
          className="root"
          editing={{ brace: 'json' }}
          handle={handle}
        />,
      )
      expect(container.firstChild).toMatchSnapshot()
    })

    it('shows Skeleton while loading data', () => {
      getObjectData.mockImplementationOnce((cases: any) =>
        AsyncResult.case(cases, AsyncResult.Pending()),
      )
      const { result } = renderHook(() => useState(handle))
      const { container } = render(
        <Editor
          {...result.current}
          className="root"
          editing={{ brace: 'json' }}
          handle={handle}
        />,
      )
      expect(container.firstChild).toMatchSnapshot()
    })

    it('shows Error when loading failed', () => {
      getObjectData.mockImplementationOnce((cases: any) =>
        AsyncResult.case(cases, AsyncResult.Err(new Error('Fail'))),
      )
      const { result } = renderHook(() => useState(handle))
      const { container } = render(
        <Editor
          {...result.current}
          className="root"
          editing={{ brace: 'json' }}
          handle={handle}
        />,
      )
      expect(container.firstChild).toMatchSnapshot()
    })
  })
})
