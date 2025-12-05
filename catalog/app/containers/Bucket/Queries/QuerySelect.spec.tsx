import * as React from 'react'
import { render } from '@testing-library/react'
import { describe, it, expect } from 'vitest'

import noop from 'utils/noop'

import QuerySelect from './QuerySelect'

describe('containers/Bucket/Queries/QuerySelect', () => {
  it('should render', () => {
    const { container } = render(
      <QuerySelect label="Label" queries={[]} onChange={noop} value={null} />,
    )
    expect(container.firstChild).toMatchSnapshot()
  })
  it('should render with selected value', () => {
    const queries = [
      { key: 'key1', name: 'name1', url: 'url1' },
      { key: 'key2', name: 'name2', url: 'url2' },
    ]
    const { container } = render(
      <QuerySelect label="Label" queries={queries} onChange={noop} value={queries[1]} />,
    )
    expect(container.firstChild).toMatchSnapshot()
  })
})
