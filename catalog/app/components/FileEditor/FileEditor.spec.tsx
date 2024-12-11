import * as React from 'react'
import renderer from 'react-test-renderer'
import { renderHook } from '@testing-library/react-hooks'

import AsyncResult from 'utils/AsyncResult'

import { useState } from './State'
import { Editor } from './FileEditor'

jest.mock('utils/AWS', () => ({ S3: { use: () => {} } }))

jest.mock('./Skeleton', () => () => <div>Skeleton</div>)

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
  jest.fn(() => () => <h1>Display error</h1>),
)

jest.mock(
  'components/Preview/loaders/utils',
  jest.fn(() => ({
    ...jest.requireActual('components/Preview/loaders/utils'),
    useObjectGetter: () => ({
      case: (cases: any) => AsyncResult.case(cases, AsyncResult.Ok({ Body: 'body' })),
    }),
  })),
)

jest.mock(
  './TextEditor',
  jest.fn(() => () => <h1>Text Editor</h1>),
)

jest.mock(
  'constants/config',
  jest.fn(() => ({})),
)

const loadMode = jest.fn((): 'fulfilled' => {
  throw Promise.resolve(null)
})

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
    const { result } = renderHook(() => useState(handle))
    it('Show skeleton', () => {
      const tree = renderer
        .create(
          <Editor
            {...result.current}
            className="root"
            editing={{ brace: 'json' }}
            handle={handle}
          />,
        )
        .toJSON()
      expect(tree).toMatchSnapshot()
    })

    it('Show TextEditor', () => {
      loadMode.mockImplementation(() => 'fulfilled')
      const tree = renderer
        .create(
          <Editor
            {...result.current}
            className="root"
            editing={{ brace: 'json' }}
            handle={handle}
          />,
        )
        .toJSON()
      expect(tree).toMatchSnapshot()
    })
  })
})
