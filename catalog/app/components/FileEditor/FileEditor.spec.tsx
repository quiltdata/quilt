import * as React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { render } from '@testing-library/react'
import { renderHook } from '@testing-library/react-hooks'

import AsyncResult from 'utils/AsyncResult'
import noop from 'utils/noop'

import { useState } from './State'
import { Editor } from './FileEditor'

vi.mock('utils/AWS', () => ({ S3: { use: noop } }))

vi.mock('./Skeleton', () => ({ default: () => <div id="Skeleton" /> }))

vi.mock('utils/NamedRoutes', async () => ({
  ...(await vi.importActual('utils/NamedRoutes')),
  use: vi.fn(() => ({ urls: {} })),
}))

vi.mock('react-router-dom', async () => ({
  ...(await vi.importActual('react-router-dom')),
  useParams: vi.fn(() => ({ bucket: 'b', key: 'k' })),
  useLocation: vi.fn(() => ({ search: '?edit=true' })),
}))

vi.mock('components/Preview/Display', () => ({
  default: () => <div id="error" />,
}))

const getObjectData = vi.fn((cases: any) =>
  AsyncResult.case(cases, AsyncResult.Ok({ Body: 'body' })),
)

vi.mock('components/Preview/loaders/utils', async () => ({
  ...(await vi.importActual('components/Preview/loaders/utils')),
  useObjectGetter: () => ({
    case: getObjectData,
  }),
}))

vi.mock('./TextEditor', () => ({
  default: ({ initialValue }: { initialValue: string }) => (
    <div id="Text Editor">
      <span id="initialValue">{initialValue}</span>
    </div>
  ),
}))

vi.mock('constants/config', () => ({ default: {} }))

const loadMode = vi.fn(() => 'fulfilled')

vi.mock('./loader', () => ({
  loadMode: vi.fn(() => loadMode()),
  detect: () => 'text',
  useWriteData: noop,
}))

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
