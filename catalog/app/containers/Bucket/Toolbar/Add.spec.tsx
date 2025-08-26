import * as React from 'react'
import renderer from 'react-test-renderer'

import Add from './Add'

jest.mock('@material-ui/core', () => ({
  ...jest.requireActual('@material-ui/core'),
  IconButton: ({ className, children }: any) => <button {...{ className, children }} />,
  Button: ({ className, children }: any) => <button {...{ className, children }} />,
}))

describe('containers/Bucket/Toolbar/Add', () => {
  it('should render with default label', () => {
    const tree = renderer
      .create(<Add className="custom-class">Hello, Popover!</Add>)
      .toJSON()
    expect(tree).toMatchSnapshot()
  })

  it('should render with custom label', () => {
    const tree = renderer
      .create(<Add label="Custom Add Label">Hello, Popover!</Add>)
      .toJSON()
    expect(tree).toMatchSnapshot()
  })
})
