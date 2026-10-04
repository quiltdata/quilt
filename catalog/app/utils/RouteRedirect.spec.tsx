import * as React from 'react'
import * as RRDom from 'react-router-dom'
import { createMemoryHistory } from 'history'
import { render } from '@testing-library/react'
import { describe, it, expect } from 'vitest'

import RouteRedirect from './RouteRedirect'

describe('utils/RouteRedirect', () => {
  it('replaces the location with an encoded `%` decoded once', () => {
    const history = createMemoryHistory({ initialEntries: ['/uri/x'] })
    render(
      <RRDom.Router history={history}>
        <RouteRedirect to="/b/x/tree/100%25done.csv?resolvedFrom=y" />
      </RRDom.Router>,
    )
    expect(history.location.pathname).toBe('/b/x/tree/100%done.csv')
    expect(history.location.search).toBe('?resolvedFrom=y')
    expect(history.length).toBe(1)
  })
})
