import * as React from 'react'
import renderer from 'react-test-renderer'

import QuerySelect from './QuerySelect'

describe('containers/Bucket/Queries/QuerySelect', () => {
  it('should render', () => {
    const tree = renderer
      .create(<QuerySelect className="" queries={[]} onChange={() => {}} value={null} />)
      .toJSON()
    expect(tree).toMatchSnapshot()
  })
  it('should render with selected value', () => {
    const queries = [
      { key: 'key1', name: 'name1', url: 'url1' },
      { key: 'key2', name: 'name2', url: 'url2' },
    ]
    const tree = renderer
      .create(
        <QuerySelect
          className="class"
          queries={queries}
          onChange={() => {}}
          value={queries[1]}
        />,
      )
      .toJSON()
    expect(tree).toMatchSnapshot()
  })
})
