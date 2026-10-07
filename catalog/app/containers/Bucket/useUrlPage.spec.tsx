import * as React from 'react'
import * as RRDom from 'react-router-dom'
import { createMemoryHistory } from 'history'
import { act, renderHook } from 'utils/renderHook'
import { describe, it, expect } from 'vitest'

import useUrlPage from './useUrlPage'

describe('containers/Bucket/useUrlPage', () => {
  it('reads and replaces the page in the URL, keeping other params', () => {
    const history = createMemoryHistory({ initialEntries: ['/b/x/tree/d/?prefix=a&p=2'] })
    const { result } = renderHook(() => useUrlPage(), {
      wrapper: ({ children }) => (
        <RRDom.Router history={history}>{children}</RRDom.Router>
      ),
    })
    expect(result.current[0]).toBe(1)

    act(() => result.current[1](2))
    expect(history.location.search).toBe('?prefix=a&p=3')
    expect(result.current[0]).toBe(2)
    expect(history.length).toBe(1)

    act(() => result.current[1](0))
    expect(history.location.search).toBe('?prefix=a')
  })

  it.each(['abc', '0', '-3', '1.5'])('reads p=%s as a whole page index', (p) => {
    const history = createMemoryHistory({ initialEntries: [`/b/x/tree/?p=${p}`] })
    const { result } = renderHook(() => useUrlPage(), {
      wrapper: ({ children }) => (
        <RRDom.Router history={history}>{children}</RRDom.Router>
      ),
    })
    expect(result.current[0]).toBe(0)
  })
})
