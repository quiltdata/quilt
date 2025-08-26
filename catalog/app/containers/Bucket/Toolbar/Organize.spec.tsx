import * as React from 'react'
import renderer from 'react-test-renderer'

import Organize from './Organize'

jest.mock('@material-ui/core', () => ({
  ...jest.requireActual('@material-ui/core'),
  IconButton: ({ className, children }: any) => <button {...{ className, children }} />,
  Button: ({ className, children }: any) => <button {...{ className, children }} />,
}))

jest.mock('containers/Bucket/Selection/Provider', () => ({
  useSelection: jest.fn(() => ({
    isEmpty: false,
    totalCount: 5,
    inited: true,
  })),
}))

describe('containers/Bucket/Toolbar/Organize', () => {
  const mockOnReload = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should render with selection items', () => {
    const tree = renderer
      .create(
        <Organize onReload={mockOnReload} className="custom-class">
          Hello, Popover!
        </Organize>,
      )
      .toJSON()
    expect(tree).toMatchSnapshot()
  })
})
