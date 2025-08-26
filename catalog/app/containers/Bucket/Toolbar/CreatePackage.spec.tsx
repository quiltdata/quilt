import * as React from 'react'
import renderer from 'react-test-renderer'

import CreatePackage from './CreatePackage'

jest.mock('@material-ui/core', () => ({
  ...jest.requireActual('@material-ui/core'),
  IconButton: ({ className, children }: any) => <button {...{ className, children }} />,
  Button: ({ className, children }: any) => <button {...{ className, children }} />,
}))

jest.mock('containers/Bucket/Selection/Provider', () => ({
  useSelection: jest.fn(() => ({
    isEmpty: true,
    totalCount: 0,
    inited: true,
  })),
}))

describe('containers/Bucket/Toolbar/CreatePackage', () => {
  it('should render with empty selection', () => {
    const tree = renderer
      .create(<CreatePackage className="custom-class">Hello, Popover!</CreatePackage>)
      .toJSON()
    expect(tree).toMatchSnapshot()
  })
})
