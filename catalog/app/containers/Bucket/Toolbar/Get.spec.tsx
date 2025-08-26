import * as React from 'react'
import renderer from 'react-test-renderer'

import Get from './Get'

jest.mock('@material-ui/core', () => ({
  ...jest.requireActual('@material-ui/core'),
  IconButton: ({ className, children }: any) => <button {...{ className, children }} />,
  Button: ({ className, children }: any) => <button {...{ className, children }} />,
}))

describe('containers/Bucket/Toolbar/Get', () => {
  it('should render with default label', () => {
    const tree = renderer
      .create(<Get className="custom-class">Hello, Popover!</Get>)
      .toJSON()
    expect(tree).toMatchSnapshot()
  })

  it('should render with custom label', () => {
    const tree = renderer
      .create(<Get label="Custom Get Label">Hello, Popover!</Get>)
      .toJSON()
    expect(tree).toMatchSnapshot()
  })
})
